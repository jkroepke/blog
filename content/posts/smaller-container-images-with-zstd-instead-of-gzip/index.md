+++
date = '2026-11-07T10:00:00+01:00'
title = 'Smaller Container Images with zstd Instead of gzip'
description = 'Container image layers are still compressed with gzip by default. zstd makes them 10 to 30 % smaller and decompresses about five times faster. How image layers are compressed, how to build zstd images with BuildKit, the cache traps I ran into, and where zstd still breaks.'
categories = ['Kubernetes']
tags = ['Docker', 'BuildKit', 'containerd', 'Kubernetes', 'zstd', 'Container Images']
+++

Do you know how the layers of your container images are compressed?

Most likely with gzip. Not because somebody decided it. It is just the default, and nobody changes defaults.

I recently ran into this while working on the node image for [Kubernetes in your browser](/kubernetes/), the small experiment on this blog where a real Kubernetes control plane runs as WebAssembly in a browser tab.
To join a node, you start a container with a kubelet and containerd. Nobody wants to wait for a large download before a demo starts, so I tried to make that image as small as possible.

Removing unused tools and stripping binaries helped, as expected.
What surprised me was a single line in the build workflow: switching the layer compression from gzip to zstd.
The image became about 20 % smaller. Without touching a single file inside it.

zstd has been part of the OCI image specification for years. So why is almost every image I pull still gzip?

I could not find a good reason. For images you build and run yourself, I think zstd should be the default.

## How image layers are compressed

A container image is not one file. It consists of a manifest, a config, and a list of layers.
Each layer is a tar archive with the files that one build step added or changed.
The registry does not store this tar archive directly. It stores a compressed version of it, called a blob.

When a node pulls an image, the container runtime:

1. Fetches the manifest and reads the list of layer blobs.
2. Downloads each blob that is not already on the node.
3. Decompresses the blob.
4. Unpacks the tar archive into the snapshotter, for example overlayfs.

The manifest also tells the runtime how each blob is compressed, through its media type.
A gzip layer looks like this:

```json
{
  "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
  "digest": "sha256:...",
  "size": 160934127
}
```

For zstd, the media type ends with `tar+zstd` instead.
zstd is not a new image format. It is the same tar archive, only compressed differently.
The compression is not hidden inside the blob. It is part of the image format.
That means every client must understand the media type, or it cannot pull the image.

gzip is the default because Docker used it from the beginning, long before the OCI specification existed.
It was a good choice at that time. Today, it is not anymore.

## Why zstd fits this workload better

[zstd](https://facebook.github.io/zstd/) is a compression algorithm from Facebook, released in 2016.
It fits this workload well: decompression is fast at every level, and there is a wide range of levels to trade build time for size.

gzip has neither. Decompression is slow, and higher levels barely improve the result.

For a platform team, both sides of the pull matter:

- Size means registry storage, network egress, and the time a new node needs before its pods can start.
- Decompression speed means CPU on the node during the pull.

Many people forget the CPU part.
When the cluster autoscaler adds ten nodes at once, every one of them pulls the same images at the same time.
In practice, decompression then competes for CPU with the kubelet, the CNI plugin, and the first pods that are already starting.

## Measuring the difference

I did not want to trust benchmarks from someone else, so I measured it myself.

I took three popular images from Docker Hub (`nginx:1.29`, `postgres:17`, and `python:3.13-slim`, all linux/amd64),
decompressed every layer, and compressed the raw tar archives again with gzip and zstd at different levels.
This test uses the C libraries (zlib and libzstd), single-threaded, on a cloud VM with 4 vCPUs.

| Compression                 | nginx:1.29 | postgres:17 | python:3.13-slim |    Total | vs. gzip level 6 | Decompression |
|-----------------------------|-----------:|------------:|-----------------:|---------:|-----------------:|--------------:|
| Uncompressed tar            |   164.5 MB |    461.1 MB |         122.5 MB | 748.1 MB |            284 % |             - |
| Docker Hub original (gzip)  |    62.9 MB |    161.3 MB |          43.1 MB | 267.3 MB |            102 % |        5.86 s |
| gzip level 6                |    62.2 MB |    157.9 MB |          43.0 MB | 263.1 MB |            100 % |        5.32 s |
| gzip level 9                |    61.9 MB |    157.0 MB |          42.8 MB | 261.7 MB |             99 % |        5.18 s |
| zstd level 3                |    56.6 MB |    142.8 MB |          37.5 MB | 236.9 MB |             90 % |        1.08 s |
| zstd level 9                |    49.3 MB |    127.6 MB |          33.9 MB | 210.8 MB |             80 % |        1.94 s |
| zstd level 19               |    43.8 MB |    111.8 MB |          30.2 MB | 185.8 MB |             71 % |        2.21 s |

Decompression is the total single-threaded time for all layers of the three images.

gzip level 9 is not worth it. It needs three to four times the CPU of level 6 and saves less than 1 %. Tuning gzip does not help. Switching does.

The bigger difference is decompression. zstd at the default level decompresses about five times faster than gzip, and even level 19 is still more than twice as fast. The smaller image is paid once in CI, not on every node that pulls it.

### What BuildKit actually produces

The table above shows what is possible with libzstd. BuildKit does not use libzstd.
It uses the pure Go encoder from [klauspost/compress](https://github.com/klauspost/compress), which maps the zstd levels to four internal speed modes.
All levels above 10 end up in its "best" mode, which is roughly comparable to zstd level 11, not 19.

So I repeated the test with BuildKit itself (Docker 29.9, buildx 0.38).
I built the `postgres:17` root filesystem as a single layer, with an empty build cache for every run:

| BuildKit output       | Layer size | vs. gzip | Build time |
|-----------------------|-----------:|---------:|-----------:|
| `compression=gzip`    |   160.9 MB |    100 % |     24.1 s |
| gzip, level 9         |   160.3 MB |   99.6 % |     58.9 s |
| `compression=zstd`    |   146.5 MB |     91 % |     11.1 s |
| zstd, level 9         |   138.4 MB |     86 % |     14.7 s |
| zstd, level 19        |   128.1 MB |     80 % |     34.5 s |

The build time includes copying 450 MB of files into the image, so the difference caused by the compression alone is even larger.

The default zstd setting builds about twice as fast as the default gzip setting and is still 9 % smaller.
Level 19 costs around 10 seconds more than gzip and produces a 20 % smaller layer.
For me, that is an easy trade in a CI pipeline.

I also loaded these images into Docker with the containerd image store (`docker load`, three runs each).
The gzip image took 6.5 seconds on average, the zstd images 5.3 to 5.4 seconds.
That is about 18 % faster, even though unpacking here is mostly limited by writing 450 MB to disk, not by decompression.
On a real pull from a registry, the node additionally downloads 20 % less data.

## Building zstd images

The [image exporter](https://docs.docker.com/build/exporters/image-registry/) of BuildKit has four options that matter here:

| Option              | Values                                    | What it does                                                         |
|---------------------|-------------------------------------------|----------------------------------------------------------------------|
| `compression`       | `uncompressed`, `gzip`, `estargz`, `zstd` | Compression for new layers. The default is `gzip`.                   |
| `compression-level` | `0..22` for zstd, `0..9` for gzip         | The compression level. The default for zstd is 3.                    |
| `force-compression` | `true`, `false`                           | Also re-compress existing layers, such as the layers of the base image. |
| `oci-mediatypes`    | `true`, `false`                           | Use OCI media types. The Docker media types have no zstd variant.    |

A complete build command looks like this:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --output type=image,name=ghcr.io/example/app:1.0.0,push=true,compression=zstd,compression-level=9,force-compression=true,oci-mediatypes=true \
  .
```

In my tests, BuildKit switched to OCI media types automatically as soon as zstd was selected.
I still set `oci-mediatypes=true` explicitly, because it documents the intent for the next person reading the build script.

There is one requirement: you need either a `docker-container` builder (`docker buildx create --use`) or Docker with the containerd image store.
The containerd image store is the default for new installations since Docker 29. The classic Docker image store cannot export zstd layers.

### GitHub Actions

With [docker/build-push-action](https://github.com/docker/build-push-action), replace `push: true` with an `outputs` line:

```yaml
- uses: docker/build-push-action@v6
  with:
    context: .
    platforms: linux/amd64,linux/arm64
    tags: ghcr.io/example/app:1.0.0
    outputs: type=image,push=true,compression=zstd,compression-level=19,force-compression=true,oci-mediatypes=true
```

This is the line I added for the [kwasm node image](https://github.com/jkroepke/blog/tree/main/kwasm).

### Podman and Buildah

Podman and Buildah handle compression differently from BuildKit. Locally, they store layers uncompressed.
The compression happens when you push the image, so you set it on `push`, not on `build`:

```bash
podman build -t registry.example.com/app:1.0.0 .
podman push --compression-format zstd --compression-level 19 registry.example.com/app:1.0.0
```

`buildah push` accepts the same flags. For zstd, the level range is 1 to 20.

`--force-compression` exists here too, but it is enabled automatically when you pass `--compression-format` on the command line.
That means the first cache trap I describe below for BuildKit does not hit you in the same way.

If you do not want to remember the flags, set a default in `containers.conf`:

```toml
[engine]
compression_format = "zstd"
compression_level = 19
```

Podman also supports `zstd:chunked`. It is still zstd, but with additional metadata that allows CRI-O and Podman to pull only the files that are not already on the node.
Other runtimes treat it as normal zstd.

### Converting existing images

If you want to try zstd before changing any build, [skopeo](https://github.com/podman-container-tools-community/skopeo) and
[regclient](https://github.com/regclient/regclient) can re-compress an image while copying it to another registry:

```bash
docker run --rm ghcr.io/podman-container-tools-community/skopeo:v1 copy --all \
  --dest-compress-format zstd --dest-compress-level 19 --dest-force-compress-format \
  docker://docker.io/library/postgres:17 \
  docker://registry.example.com/mirror/postgres:17-zstd
```

Without `--dest-force-compress-format`, skopeo may reuse existing gzip blobs. This is the same behavior as in BuildKit, which I explain in the next section.

This works well if you already mirror public images into an internal registry, which I recommend anyway.

## The two BuildKit cache traps I ran into

While measuring, I lost some time because the results did not change when I expected them to.
Both problems come from the BuildKit cache, and neither of them produces a warning.

### Trap 1: without `force-compression`, existing layers stay gzip

BuildKit applies the `compression` option only to layers it creates in this build.
Layers that already exist in the cache, including every layer of the image in your `FROM` line, are reused as they are.

I built the same image twice, first with gzip and then with `compression=zstd`.
The second export still contained a `tar+gzip` layer with exactly the same digest as before. Only `force-compression=true` converted it.

The tricky part is the base image. In a typical application image, it holds most of the bytes.
Without `force-compression=true`, you can end up with an image that is still mostly gzip, while the build script says zstd.

### Trap 2: the compression level is not part of the cache key

After building a zstd layer at level 3, I built again with `compression-level=19,force-compression=true`.
BuildKit returned the level 3 blob from the cache, with the same size and the same digest.

BuildKit converts layers when the compression type is wrong.
A blob with the right type but a different level is considered fine.
In CI with a fresh builder, this does not matter. On a long-living builder or with a shared cache, prune the cache once after changing the level.

Because of these two traps, I do not trust the flags alone. I check the media types in the registry:

```bash
docker buildx imagetools inspect --raw ghcr.io/example/app:1.0.0 | jq '.manifests[0].digest'
docker buildx imagetools inspect --raw ghcr.io/example/app:1.0.0@sha256:... | jq '.layers[].mediaType'
```

Every layer should be `application/vnd.oci.image.layer.v1.tar+zstd`.

## Who can pull zstd images

The compression is part of the media type.
A client either understands `tar+zstd`, or the pull fails with an error about an unsupported media type. There is no automatic fallback to gzip.

| Component                 | zstd support |
|---------------------------|--------------|
| OCI image spec            | `application/vnd.oci.image.layer.v1.tar+zstd`, part of the spec for years |
| containerd                | since [1.5](https://github.com/containerd/containerd/releases/tag/v1.5.0) (2021) |
| CRI-O, Podman, Buildah    | via containers/image for years, including `zstd:chunked` |
| Docker Engine             | since [23.0](https://docs.docker.com/engine/release-notes/23.0/) (2023) |
| BuildKit / docker buildx  | `compression=zstd` in the image exporter |

Kubernetes itself does not care about the compression.
The kubelet never touches layers; the container runtime does.
In practice, current Kubernetes distributions ship containerd 1.7 or 2.x, or a current CRI-O. All of them can pull zstd images.

The clusters are not the problem. The tools around them are:

- CI runners and developer machines that still run a Docker Engine older than 23.0.
- Security scanners, SBOM tools, and admission controllers that download and unpack layers themselves. Current versions of the common tools support zstd, but check the version you actually run, not the latest release.
- Lazy pulling: eStargz and SOCI are built around gzip. If you depend on them, zstd is not a drop-in replacement. On CRI-O and Podman, `zstd:chunked` provides lazy pulling for zstd.
- Registries store blobs and usually do not look at the media type. Docker Hub, GHCR, ECR, ACR, Google Artifact Registry, Quay, and Harbor all serve zstd images. Very old self-hosted registries and proxies with a media type allowlist can be an exception.

## When I would not use zstd

### Public images with unknown consumers

If you publish an image that anybody can pull, somebody will pull it with Docker 20.10 on a forgotten build server, and the bug report will end up with you.
For public images, I would keep gzip for the default tag and publish zstd as an additional tag, at least until old clients are really gone.

It is technically possible to put gzip and zstd variants of the same platform into one image index, for example with `podman manifest push --add-compression zstd`.
But older clients do not select a manifest by compression. So it does not help the clients that need it.

### Very small images

A 10 MB distroless image with a single Go binary will not pull noticeably faster.
Switching does not hurt, but do not expect a visible difference.

For everything else, meaning internal images that run on your own clusters, I see no reason to wait.

## My current approach

1. Build every internal image with `compression=zstd,force-compression=true,oci-mediatypes=true`.
2. Use level 9 as the default. It is barely slower to build than level 3 and around 10 % smaller.
3. Use level 19 for large images that are pulled very often, such as node images, CI runner images, or ML images. The additional CI minutes pay off with the first scale-up of the cluster.
4. Re-compress public images with zstd when mirroring them into an internal registry.
5. Check the tools before the switch, especially old Docker Engines in CI and the scanners in the pipeline. The clusters are usually fine.
6. Verify the media types in the registry instead of trusting the build flags.

For the kwasm node image, it was one line.
Are you already using zstd for your images, or did something in your toolchain stop you?
