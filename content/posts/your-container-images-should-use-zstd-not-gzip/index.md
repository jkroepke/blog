+++
date = '2026-11-07T10:00:00+01:00'
title = 'Your Container Images Should Use zstd, Not gzip'
description = 'Container image layers are still compressed with gzip by default. zstd makes them 10 to 30 % smaller and decompresses about five times faster. How to build zstd images with BuildKit, the cache traps, and where zstd still breaks.'
categories = ['Kubernetes']
tags = ['Docker', 'BuildKit', 'containerd', 'Kubernetes', 'zstd', 'Container Images']
+++

Almost every container image you pull today is compressed with **gzip**.
Not because gzip is good, but because it was the default in 2013 and nobody changed it.

[zstd](https://facebook.github.io/zstd/) has been part of the
[OCI image specification](https://github.com/opencontainers/image-spec/blob/main/layer.md#zstd-media-types) for years.
containerd can pull it since 1.5, Docker since 23.0, and BuildKit can produce it with one flag.
Still, I rarely see it in the wild.

I think that is a mistake. For images you build and run yourself, zstd should be the default.

## TL;DR

Build with:

```bash
docker buildx build \
  --output type=image,name=registry.example.com/app:1.0.0,push=true,compression=zstd,compression-level=9,force-compression=true,oci-mediatypes=true \
  .
```

In my measurements, zstd layers were **10 to 30 % smaller** than gzip and decompressed **about five times faster**.
BuildKit also *built* them faster than gzip at the default levels.

The only real reason not to switch is a consumer that cannot read zstd: Docker Engine older than 23.0, containerd older than 1.5, or an old scanner or tool in your pipeline.
If you control the runtime, that list is empty.

## Why gzip is the wrong default

An image layer is a tar archive, and the registry stores it compressed.
On every pull, the node downloads the compressed blob, decompresses it, and unpacks the tar into the snapshotter.

gzip is slow on both sides of that path and does not compress particularly well.
zstd was designed for exactly this kind of workload: fast decompression at every compression level, and a wide range of levels to trade build time for size.

For a platform team, both sides matter:

- **Size** is registry storage, egress cost, and the time a new node needs before your pods start.
- **Decompression speed** is CPU on the node during pull, which hurts most when a cluster autoscaler adds ten nodes and every one of them pulls the same 2 GB of images at the same time.

## The numbers

I took three popular images from Docker Hub (`nginx:1.29`, `postgres:17`, `python:3.13-slim`, linux/amd64),
decompressed every layer, and compressed the raw tar again with gzip and zstd at different levels.
This uses the C libraries (zlib and libzstd) on a 4 vCPU cloud VM, single-threaded.

| Compression   | Total size | vs. gzip-6 | Decompression |
|---------------|-----------:|-----------:|--------------:|
| gzip level 6  |   263.1 MB |      100 % |        5.32 s |
| gzip level 9  |   261.7 MB |       99 % |        5.18 s |
| zstd level 3  |   236.9 MB |       90 % |        1.08 s |
| zstd level 9  |   210.8 MB |       80 % |        1.94 s |
| zstd level 19 |   185.8 MB |       71 % |        2.21 s |

Two things stand out.

First, **gzip level 9 is useless.** It costs three to four times the CPU of level 6 and saves less than 1 %.
If someone tells you to "just tune gzip", this is the answer.

Second, **even the slowest zstd setting decompresses more than twice as fast as gzip**, and the default level is five times faster.
With zstd, you pay for a smaller image once in CI and never again on the nodes.

### What BuildKit actually produces

The table above is the upper bound. BuildKit does not use libzstd, but the pure Go encoder from
[klauspost/compress](https://github.com/klauspost/compress), which maps the zstd levels to four internal speeds.
Levels above 10 all end up in its "best" mode, which is roughly zstd level 11, not 19.

So I also built the `postgres:17` root filesystem as a single layer with BuildKit (Docker 29.9, buildx 0.38) and an empty build cache for every run:

| BuildKit output       | Layer size | vs. gzip | Build time |
|-----------------------|-----------:|---------:|-----------:|
| `compression=gzip`    |   160.9 MB |    100 % |     24.1 s |
| gzip, level 9         |   160.3 MB |   99.6 % |     58.9 s |
| `compression=zstd`    |   146.5 MB |     91 % |     11.1 s |
| zstd, level 9         |   138.4 MB |     86 % |     14.7 s |
| zstd, level 19        |   128.1 MB |     80 % |     34.5 s |

The build time includes copying 450 MB into the image, so the difference in compression itself is even larger.

Default zstd builds **twice as fast** as default gzip and is still 9 % smaller.
zstd at level 19 costs 10 seconds more than gzip for a 20 % smaller layer. That is a trade I would take in every CI pipeline.

Loading these images into Docker with the containerd image store (`docker load`, three runs each) took 6.5 s on average for gzip and 5.3 to 5.4 s for zstd.
That is about 18 % faster for the unpack part alone, and here unpacking is bound by writing 450 MB to disk, not by decompression.
On a real pull, you also download 20 % less.

## How to build zstd images

### docker buildx and BuildKit

The [image exporter](https://docs.docker.com/build/exporters/image-registry/) has four options that matter:

| Option              | Values                              | What it does                                                    |
|---------------------|-------------------------------------|-----------------------------------------------------------------|
| `compression`       | `uncompressed`, `gzip`, `estargz`, `zstd` | Compression for new layers. Default is `gzip`.            |
| `compression-level` | `0..22` for zstd, `0..9` for gzip   | The level. Default is 3 for zstd.                               |
| `force-compression` | `true`, `false`                     | Also re-compress layers that already exist, like base image layers. |
| `oci-mediatypes`    | `true`, `false`                     | Use OCI media types. Docker media types have no zstd type.      |

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --output type=image,name=ghcr.io/example/app:1.0.0,push=true,compression=zstd,compression-level=9,force-compression=true,oci-mediatypes=true \
  .
```

In my tests, BuildKit switched to OCI media types automatically as soon as zstd was selected, even with `type=docker`.
I still set `oci-mediatypes=true` explicitly. It documents the intent and costs nothing.

You need either a `docker-container` builder (`docker buildx create --use`) or Docker with the containerd image store,
which is the default for new installations since Docker 29. The classic Docker image store cannot export zstd.

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

That is exactly what I do for the node image of [kwasm](https://github.com/jkroepke/blog/tree/main/kwasm), the Kubernetes in the browser experiment on this blog.

### Converting existing images

You do not have to rebuild to try it. [skopeo](https://github.com/containers/skopeo) and
[regclient](https://github.com/regclient/regclient) can re-compress an image while copying it:

```bash
skopeo copy --all \
  --dest-compress-format zstd --dest-compress-level 19 --dest-force-compress-format \
  docker://docker.io/library/postgres:17 \
  docker://registry.example.com/mirror/postgres:17-zstd
```

Without `--dest-force-compress-format`, skopeo may reuse existing gzip blobs. Same trap as in BuildKit, see below.

This is useful if you already mirror public images into an internal registry anyway, which you should.

## The two cache traps

These cost me some time, so I want to save you that.

**Trap 1: without `force-compression`, nothing happens.**
BuildKit only applies `compression` to layers it creates. Layers that already exist in the cache, including every layer of your `FROM` image, are reused as they are.
I built the same image twice, first with gzip, then with `compression=zstd`. The second export still contained a `tar+gzip` layer with the exact same digest.
No warning, no error. Only `force-compression=true` converted it.

For a typical application image, most bytes live in the base image. Without `force-compression=true`, you might ship a 95 % gzip image and think you switched.

**Trap 2: the level is not part of the cache key.**
After I had built a zstd layer at level 3, building again with `compression-level=19,force-compression=true` returned the level 3 blob from the cache. Same size, same digest.
BuildKit converts layers whose compression *type* is wrong. A blob with the right type and the wrong level counts as fine.

In CI with a fresh builder, this does not matter. On a long-living builder or with a shared cache, prune the cache once after you change the level, or you are not measuring what you think you are measuring.

Check the result instead of trusting the flags:

```bash
docker buildx imagetools inspect --raw ghcr.io/example/app:1.0.0 | jq '.manifests[0].digest'
docker buildx imagetools inspect --raw ghcr.io/example/app:1.0.0@sha256:... | jq '.layers[].mediaType'
```

Every layer should be `application/vnd.oci.image.layer.v1.tar+zstd`.

## Who can pull zstd images

zstd is an OCI media type. A client either understands it or fails the pull with an error about an unsupported media type.
There is no fallback.

| Component                 | zstd support since |
|---------------------------|--------------------|
| OCI image spec            | `application/vnd.oci.image.layer.v1.tar+zstd`, part of the spec for years |
| containerd                | [1.5](https://github.com/containerd/containerd/releases/tag/v1.5.0) (2021) |
| CRI-O, Podman, Buildah    | via containers/image, for years, including `zstd:chunked` |
| Docker Engine             | [23.0](https://docs.docker.com/engine/release-notes/23.0/) (2023) |
| BuildKit / docker buildx  | `compression=zstd` in the image exporter |

**Kubernetes itself does not care.** The kubelet never touches layers; the container runtime does.
Every supported Kubernetes version runs on containerd 1.7 or 2.x, or on a current CRI-O. All of them pull zstd.
If your clusters are still on containerd 1.4 or on Docker through cri-dockerd with an Engine older than 23.0, you have bigger problems than image compression.

The places where zstd breaks are not the clusters. They are everything around them:

- **CI runners and developer machines** with an old Docker Engine.
- **Security scanners, SBOM tools, and admission controllers** that unpack layers themselves. Current versions of the common tools handle zstd, but check the version you actually run, not the latest one.
- **Lazy pulling.** eStargz and SOCI are built around gzip. If you depend on them, zstd is not a drop-in replacement. On CRI-O and Podman, `zstd:chunked` is the zstd answer to that.
- **Registries** store blobs and usually do not care about the media type. Docker Hub, GHCR, ECR, ACR, Google Artifact Registry, Quay, and Harbor all serve zstd images. Very old self-hosted registries and some proxies with media type allowlists are the exception.

## When I would not use zstd

**Public images with unknown consumers.** If you publish an image that anyone can pull, somebody will pull it with Docker 20.10 on a forgotten build server, and the bug report will land with you.
For public images, I would keep gzip as the default tag and publish zstd as an additional tag, or wait until the old clients are really gone.
You can technically put gzip and zstd variants of the same platform into one index, but older clients do not select by compression, so this does not help the clients you are trying to help.

**Tiny images.** A 10 MB distroless image with a Go binary does not get meaningfully faster. You can still switch; just do not expect a visible effect.

Everything else, meaning internal images that run on your own clusters, I would build with zstd today.

## My recommendation

- Use `compression=zstd,force-compression=true,oci-mediatypes=true` for every internal image.
- Use **level 9** as the default. It is barely slower to build than level 3 and around 10 % smaller.
- Use **level 19** for large images that are pulled very often, such as node images, CI runner images, or ML images. The extra CI minutes pay off on the first autoscaling event.
- Re-compress mirrored public images to zstd when you copy them into your own registry.
- Check old Docker Engines in CI and the scanners in your pipeline before the switch. Not the clusters.
- Verify the media types in the registry. The flags alone do not prove anything, see the cache traps above.

gzip is a default from 2013. Defaults are not decisions. Make one.
