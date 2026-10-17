+++
date = '2026-10-17T22:56:00+02:00'
title = 'Docker Hardened Images Might Be the Next Bitnami'
description = 'Docker Hardened Images are free and Apache 2.0 today. So was Bitnami. Prefer upstream distroless images and keep any hardened image catalog replaceable.'
categories = ['Kubernetes']
tags = ['Docker', 'Container Security', 'Distroless', 'Kubernetes', 'Supply Chain']
featuredImage = 'images/header.png'
+++

The recent Bitnami changes made one thing very clear: **container image catalogs can become infrastructure dependencies.**

[Docker Hardened Images (DHI)](https://www.docker.com/products/hardened-images/) are an interesting alternative.
The community catalog is free, published under Apache 2.0, and provides minimal images, SBOMs, provenance, and a very small CVE surface.

There is a lot to like about DHI. But before you move everything over, ask yourself one question: **what if DHI is the next Bitnami?**

Bitnami was also free, also open source, and also everywhere, until it was not.
Simply moving from one large image catalog to the next one misses the lesson.
The important question is not only how secure an image is today, but how difficult it becomes to replace the provider later.

A hardened image provider must remain an implementation detail.
If changing the image provider also means changing entrypoints, environment variables, filesystem layouts, or Helm charts, the dependency has already become much larger than the image itself.

## What happened with Bitnami

When Bitnami changed its public container catalog in 2025, the immediate discussion was mostly about where the images went and what would remain available for free.
Existing versioned images were moved to the
[Bitnami Legacy repository](https://github.com/bitnami/charts/issues/35164), which receives no further updates or support,
while users who wanted continued updates, version history, and commercial support were directed toward Bitnami Secure Images.

The source code for the images and Helm charts remained available under Apache 2.0, which makes the situation more interesting than a simple "open source became closed source" story.
The problem for many users was somewhere else: they had not only adopted a container image, but also the behavior around that image.

Bitnami images often came with their own startup scripts, environment variables, directory layouts, initialization logic, and conventions around how the application should be configured.
The [Bitnami PostgreSQL image](https://github.com/bitnami/containers/blob/main/bitnami/postgresql/README.md), for example, defines variables such as
`POSTGRESQL_VOLUME_DIR` and `POSTGRESQL_DATA_DIR` and adds initialization behavior around the upstream application.

That is convenient while you are using the image.
It becomes less convenient on the day you want to stop using it.

Ideally, replacing an image provider looks roughly like this:

```text
bitnami/foo -> another-registry/foo
```

In practice, it can mean checking volumes, environment variables, probes, security contexts, startup behavior, and sometimes the Helm chart itself.
At that point, the image provider is part of the application interface, even if nobody explicitly decided to design it that way.

This is the part of the Bitnami story I do not want to repeat.

## Is DHI the next Bitnami?

Maybe. Maybe not. Nobody knows, and that is exactly the point.

Docker currently publishes the DHI Community catalog for free under the
[Apache 2.0 license](https://docs.docker.com/dhi/), and the images are based on open distributions such as Debian and Alpine.
Commercial offerings add things such as SLA-backed remediation, compliance variants, customization, and extended lifecycle support.

I like that model. But look at it again: a free community catalog, an open source license, and a commercial tier next to it.
That is not very different from where Bitnami was a few years ago.
The license protected the source code, and the source code is still there. It did not protect the free updates.

No vendor can promise what its product catalog, registry structure, pricing, or commercial strategy will look like several years from now.
That is not a criticism of Docker; it is simply something you have to account for when building platform dependencies.

So yes, use DHI.
Just make sure you can stop using it without turning that decision into a project.

## Before using another catalog, ask upstream

My first choice is not DHI.

Before replacing an upstream image with one from a hardened catalog, ask the software vendor or open source project whether it can provide a minimal or distroless image itself.

This is especially relevant for Go applications.
If the binary is statically linked and the application does not require a shell, package manager, or a collection of helper binaries, there is rarely a reason to ship a full Linux userspace around it.

This keeps the image close to the application.
The same project releases the binary and the container image, and there is one less organization involved in the path from source code to what finally runs in the cluster.

Prometheus already does this, and Grafana is a good example of what I want to see more often.
The official Grafana images are available as
[Alpine, Ubuntu, and Distroless variants](https://github.com/grafana/grafana/blob/main/docs/sources/setup-grafana/configure-docker.md),
including:

```text
grafana/grafana:<version>-distroless
grafana/grafana:<version>-distroless-slim
```

If you want to run Grafana with a smaller attack surface, stay with the upstream image and use the distroless variant.
There is no need to add another catalog only to remove a shell and a package manager.

I have started asking upstream projects for exactly this, and asking works:

- [prometheus-operator/prometheus-operator#8748](https://github.com/prometheus-operator/prometheus-operator/issues/8748) is already merged.
- [thanos-io/thanos#8961](https://github.com/thanos-io/thanos/issues/8961) is still open.

More projects should offer this choice directly. If yours does not, open an issue.

## Where DHI fits very well

Of course, not every upstream project is going to publish multiple image variants.
Maintaining them takes CI time, testing, release work, and somebody has to care about it.

This is where DHI becomes very useful.

DHI already contains images for projects such as
[Thanos](https://hub.docker.com/hardened-images/catalog/dhi/thanos) and
[Kafka](https://hub.docker.com/hardened-images/catalog/dhi/kafka).

The deciding factor is compatibility, not the logo on the registry.
If the hardened image starts the same application, accepts the same arguments, uses compatible paths and users, and does not introduce its own configuration layer, then replacing the upstream image is a very reasonable choice.

Many Go applications are simple in this regard, which is exactly what I want.
There is a binary, a few flags, maybe a config file, and not much magic around it.

Other applications are more complicated.
Databases, JVM applications, or software that expects startup scripts and a particular filesystem layout can make an image swap much more involved.
Kafka is available in several catalogs, for example, but check exactly how each image is started and configured before assuming that the images are interchangeable.

## Same source, different binary

There is one detail that is easy to miss: DHI does not just repackage the upstream release binaries. It builds the software itself.

The source is the same, but the binary is not necessarily identical.
Build flags, linker flags, embedded version strings, and enabled features are decided by whoever runs the build.
Most of the time, nobody notices. Sometimes, something breaks.

I ran into this with my own project.
[helm-secrets#890](https://github.com/jkroepke/helm-secrets/issues/890) was reported because the Helm binary in the DHI image prints its version as `4.3.0+gbec5b06` instead of `v4.3.0+gbec5b06`.
Upstream release builds set the leading `v` through a build-time ldflag; the DHI build did not.
helm-secrets parsed that output, failed to detect the Helm major version, and refused to run.

Technically, this is a bug in the DHI build, but I am making the parsing in helm-secrets more tolerant anyway.
But it shows the point: a hardened image is not only a different base layer. It can also be a different build of the application.
Tools, plugins, and scripts that depend on version output or build-time behavior may not be compatible.

## Keep the upstream Helm chart

For Kubernetes, apply the same approach one level higher.

If the upstream project already provides a Helm chart you trust, keep that chart and only change the image reference.
There is little benefit in replacing both the chart and the image provider at the same time, unless the alternative chart provides something you actually need.

The change should look like this:

```yaml
image:
  repository: dhi.io/thanos
  tag: "0.42.4"
```

The exact values differ between charts, but the architecture is what matters.
The chart still comes from the upstream project and describes how the application is configured.
The hardened catalog is responsible for the image.

Moving back to the upstream image should be an equally small change:

```yaml
image:
  repository: quay.io/thanos/thanos
  tag: "v0.42.4"
```

If the change suddenly requires different environment variables, another directory layout, rewritten probes, or a new chart, then the image was never really a drop-in replacement.

This separation also has a nice side effect for platform teams.
The application team can continue following upstream documentation and chart releases, while the platform can decide which compatible image source is acceptable for the environment.

That is a dependency I can live with.

## My portability test

Before replacing an image in production, check the details first.
These are usually the details that decide whether the migration is easy later:

- Does the image use the same entrypoint and command-line arguments?
- Does it use the same UID/GID, or does the Pod security context need changes?
- Are the expected configuration and data paths identical?
- Are CA certificates and timezone data available when the application needs them?
- Does the application require a shell or helper binaries for probes or lifecycle hooks?
- Are startup, shutdown, and signal handling compatible?
- Does the image expose the same ports?
- Does the binary report the same version and behave the same as the upstream release build?
- Can you switch back to the upstream image by changing only the repository and tag?

The last question is the one that matters most.

If the answer is yes, a hardened catalog is a good choice.
If the answer is no, understand why before rolling it out across dozens or hundreds of workloads.

A small amount of friction is perfectly acceptable.
A second application interface hidden inside the container image is not.

## My current approach

My strategy is simple:

1. **Use the upstream minimal or distroless image when one exists.**
2. **If it does not exist, ask upstream to provide one.**
3. **Use DHI or another hardened catalog when the application interface remains compatible.**
4. **Keep the upstream or trusted community Helm chart whenever possible.**
5. **Avoid catalog-specific entrypoints, environment variables, and filesystem layouts unless they solve a problem you actually have.**
6. **Make switching the image provider an image change, not an application migration.**

Docker making the DHI Community catalog free and publishing it under Apache 2.0 is a positive development, and it will make hardened images much easier to adopt.

But "this catalog is free today" must not become part of the architecture.
Bitnami was free too. Plan as if DHI could become the next Bitnami, and you will not care much if it does.

The architecture I want is much simpler: the application belongs to the upstream project, the Helm chart describes the application, and the image provider can be replaced when needed.
