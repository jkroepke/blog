+++
date = '2026-09-23T15:30:00+02:00'
title = 'Docker Hardened Images Are Free. Keep Your Exit Strategy'
description = 'Docker Hardened Images are free and Apache 2.0, but platform teams should still prefer upstream distroless images and keep hardened image providers replaceable.'
categories = ['Containers']
tags = ['Docker', 'Container Security', 'Distroless', 'Kubernetes', 'Supply Chain']
+++

The recent Bitnami changes made one thing very clear: **container image catalogs can become infrastructure dependencies.**

[Docker Hardened Images (DHI)](https://www.docker.com/products/hardened-images/) are an interesting alternative.
The community catalog is free, published under Apache 2.0, and provides minimal images, SBOMs, provenance, and a very small CVE surface.

There is a lot to like about DHI, but simply moving from Bitnami to another large image catalog would miss the bigger lesson.
The important question is not only how secure an image is today, but how difficult it becomes to replace the provider later.

For me, a hardened image provider should remain an implementation detail.
If changing the image provider also means changing entrypoints, environment variables, filesystem layouts, or Helm charts, the dependency has already become much larger than the image itself.

## The Bitnami part that matters to me

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

Ideally, replacing an image provider should look roughly like this:

```text
bitnami/foo -> another-registry/foo
```

In practice, it can mean checking volumes, environment variables, probes, security contexts, startup behavior, and sometimes the Helm chart itself.
At that point, the image provider is part of the application interface, even if nobody explicitly decided to design it that way.

This is the part of the Bitnami story I would rather not repeat.

## DHI has a better starting point

Docker Hardened Images are not simply "Bitnami again".
Docker currently publishes the DHI Community catalog for free under the
[Apache 2.0 license](https://docs.docker.com/dhi/), and the images are based on open distributions such as Debian and Alpine.
Commercial offerings add things such as SLA-backed remediation, compliance variants, customization, and extended lifecycle support.

I like that model.
It makes DHI useful without immediately forcing the deployment itself into a commercial product.

It also does not mean that I want to forget the dependency question.
No vendor can promise what its product catalog, registry structure, pricing, or commercial strategy will look like several years from now.
That is not a criticism of Docker; it is simply something I try to account for when building platform dependencies.

So I would absolutely use DHI.
I just want to be able to stop using it without turning that decision into a project.

## Before using another catalog, ask upstream

My first choice is actually not DHI.

Before replacing an upstream image with one from a hardened catalog, I would first ask the software vendor or open source project whether it can provide a minimal or distroless image itself.

This is especially interesting for Go applications.
If the binary is statically linked and the application does not require a shell, package manager, or a collection of helper binaries, there is often not much reason to ship a full Linux userspace around it.

The nice part is that this keeps the image close to the application.
The same project releases the binary and the container image, and there is one less organization involved in the path from source code to what finally runs in the cluster.

I have started asking upstream projects for exactly this.
For example:

- [thanos-io/thanos#8961](https://github.com/thanos-io/thanos/issues/8961)
- [prometheus-operator/prometheus-operator#8748](https://github.com/prometheus-operator/prometheus-operator/issues/8748)

Grafana is a good example of what I would like to see more often.
The official Grafana images are available as
[Alpine, Ubuntu, and Distroless variants](https://github.com/grafana/grafana/blob/main/docs/sources/setup-grafana/configure-docker.md),
including:

```text
grafana/grafana:<version>-distroless
grafana/grafana:<version>-distroless-slim
```

If I want to run Grafana with a smaller attack surface, I can stay with the upstream image and still get a distroless variant.
There is no need to add another catalog only to remove a shell and a package manager.

I would like more projects to offer this choice directly.

## Where DHI fits very well

Of course, not every upstream project is going to publish multiple image variants.
Maintaining them takes CI time, testing, release work, and somebody has to care about it.

This is where DHI becomes very useful.

DHI already contains images for projects such as
[Thanos](https://hub.docker.com/hardened-images/catalog/dhi/thanos),
[Prometheus](https://hub.docker.com/hardened-images/catalog/dhi/prometheus), and
[Kafka](https://hub.docker.com/hardened-images/catalog/dhi/kafka).

For me, the deciding factor is compatibility rather than the logo on the registry.
If the hardened image starts the same application, accepts the same arguments, uses compatible paths and users, and does not introduce its own configuration layer, then replacing the upstream image can be a very reasonable choice.

A lot of Go applications are almost boring in this regard, which is exactly what I want.
There is a binary, a few flags, maybe a config file, and not much magic around it.

Other applications are more complicated.
Databases, JVM applications, or software that expects startup scripts and a particular filesystem layout can make an image swap much more involved.
Kafka may be available in several catalogs, for example, but I would still check exactly how each image is started and configured before assuming that the images are interchangeable.

The boring case is the good case here.

## I would keep the upstream Helm chart

For Kubernetes, I would take the same approach one level higher.

If the upstream project already provides a Helm chart that I trust, I would prefer to keep that chart and only change the image reference.
I do not see much benefit in replacing both the chart and the image provider at the same time unless the alternative chart provides something I actually need.

Conceptually, the change should be as unexciting as:

```yaml
image:
  repository: dhi.io/thanos
  tag: "0.42.4"
```

The exact values differ between charts, but the architecture is what matters.
The chart still comes from the upstream project and describes how the application is configured.
The hardened catalog is responsible for the image.

If I later decide to move back to the upstream image, I want the reverse change to be equally boring:

```yaml
image:
  repository: quay.io/thanos/thanos
  tag: "v0.42.4"
```

If that change suddenly requires different environment variables, another directory layout, rewritten probes, or a new chart, then the image was never really a drop-in replacement.

This separation also has a nice side effect for platform teams.
The application team can continue following upstream documentation and chart releases, while the platform can decide which compatible image source is acceptable for the environment.

That is a dependency I can live with.

## My portability test

Before replacing an image in production, I would check the boring details first.
These are usually the details that decide whether the migration is easy later:

- Does the image use the same entrypoint and command-line arguments?
- Does it use the same UID/GID, or does the Pod security context need changes?
- Are the expected configuration and data paths identical?
- Are CA certificates and timezone data available when the application needs them?
- Does the application require a shell or helper binaries for probes or lifecycle hooks?
- Are startup, shutdown, and signal handling compatible?
- Does the image expose the same ports?
- Can I switch back to the upstream image by changing only the repository and tag?

The last question is the one I care about most.

If the answer is yes, then I am quite happy to use a hardened catalog.
If the answer is no, I want to understand why before rolling it out across dozens or hundreds of workloads.

A small amount of friction can be perfectly acceptable.
A second application interface hidden inside the container image is something I would rather avoid.

## My current approach

For now, my strategy is fairly simple:

1. **Use the upstream minimal or distroless image when one exists.**
2. **If it does not exist, ask upstream whether providing one would make sense.**
3. **Use DHI or another hardened catalog when the application interface remains compatible.**
4. **Keep the upstream or trusted community Helm chart whenever possible.**
5. **Avoid catalog-specific entrypoints, environment variables, and filesystem layouts unless they solve a problem I actually have.**
6. **Try to make switching the image provider an image change, not an application migration.**

Docker making the DHI Community catalog free and publishing it under Apache 2.0 is a positive development, and I expect it will make hardened images much easier to adopt.

I just do not want "this catalog is free today" to become part of the architecture.

The architecture I want is much simpler: the application belongs to the upstream project, the Helm chart describes the application, and the image provider can be replaced when needed.
