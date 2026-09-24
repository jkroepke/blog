+++
date = '2026-09-23T15:30:00+02:00'
title = 'Docker Hardened Images Are Free. Keep Your Exit Strategy'
description = 'Docker Hardened Images are free and Apache 2.0, but platform teams should still prefer upstream distroless images and keep hardened image providers replaceable.'
categories = ['Containers']
tags = ['Docker', 'Container Security', 'Distroless', 'Kubernetes', 'Supply Chain']
+++

After the changes around the Bitnami container catalog, many platform teams started looking for alternatives.
At the same time, [Docker Hardened Images (DHI)](https://www.docker.com/products/hardened-images/) became very attractive:
the community catalog is free, published under Apache 2.0, and provides minimal images, SBOMs, provenance, and a very small CVE surface.

I like this direction, but I think the Bitnami change should teach us something beyond which catalog to use next.
A hardened image can be a good choice, but the image provider should ideally remain replaceable and should not become part of the application's interface.

## What happened with Bitnami

In 2025, Bitnami changed how its public container catalog works.
Existing versioned images were moved to the
[Bitnami Legacy repository](https://github.com/bitnami/charts/issues/35164), which receives no further updates or support,
while the free community catalog was reduced and production users needing continued updates, version history, and support were directed to the commercial Bitnami Secure Images offering.

The source code for the images and Helm charts remained available under Apache 2.0, so this was not simply a move from open source to closed source.
The larger operational problem was that many users depended on the built images, their tags, update process, registry, and on behavior that was specific to the Bitnami images.

For many applications, replacing a Bitnami image was therefore not just a change like this:

```text
bitnami/foo -> another-registry/foo
```

Bitnami images often provided their own initialization logic, environment variables, filesystem conventions, and startup scripts.
The [Bitnami PostgreSQL image](https://github.com/bitnami/containers/blob/main/bitnami/postgresql/README.md), for example,
defines Bitnami-specific variables such as `POSTGRESQL_VOLUME_DIR` and `POSTGRESQL_DATA_DIR` together with additional initialization behavior.

Once a Helm chart or deployment depends on those details, the image is no longer only a packaging choice.
Changing the image provider can also mean changing configuration, volumes, startup behavior, probes, or other parts of the deployment, which turns a simple image replacement into a migration project.

## DHI is not simply "Bitnami again"

Docker Hardened Images should not be treated as the same model.
Docker currently publishes the DHI Community catalog for free under the
[Apache 2.0 license](https://docs.docker.com/dhi/), and the images are based on open distributions such as Debian and Alpine.
Commercial offerings add features such as SLA-backed remediation, compliance variants, customization, and extended lifecycle support.

This gives DHI a better starting point for portability, but it does not remove the general dependency question.
Nobody knows how a vendor's products, hosting, pricing, or distribution strategy will look several years from now, and this applies to Docker just as it applies to any other commercial provider.

For that reason, my conclusion is not that DHI should be avoided.
I would use it in a way that keeps the image provider replaceable.

## Ask upstream first

Before replacing every container image with one from a hardened catalog, I would first ask the software vendor or open source project whether they can provide a minimal or distroless image themselves.

For many applications, especially statically linked Go applications, this can be relatively simple.
If the application does not need a shell, package manager, or general-purpose operating system utilities, the upstream project can often provide a small runtime image as part of the normal release process.

I prefer this approach because the image remains directly connected to the software project and its release lifecycle.
There is no additional organization between the project producing the application and the container image that I deploy.

For example, I opened requests for minimal or distroless images in:

- [thanos-io/thanos#8961](https://github.com/thanos-io/thanos/issues/8961)
- [prometheus-operator/prometheus-operator#8748](https://github.com/prometheus-operator/prometheus-operator/issues/8748)

Grafana already shows what this can look like.
The official Grafana images have
[Alpine, Ubuntu, and Distroless variants](https://github.com/grafana/grafana/blob/main/docs/sources/setup-grafana/configure-docker.md),
including tags such as:

```text
grafana/grafana:<version>-distroless
grafana/grafana:<version>-distroless-slim
```

In this case, I do not need DHI just to get a distroless Grafana image because the upstream project already provides one.

## When I would use DHI

There are still many cases where I would use Docker Hardened Images.
The important question for me is whether I can replace the image provider later without changing the application configuration.

For a simple application that starts one binary with normal command-line flags, uses the same paths, user model, and ports as upstream,
and does not depend on provider-specific initialization, a hardened image can be a very good replacement.

DHI already contains images for projects such as
[Thanos](https://hub.docker.com/hardened-images/catalog/dhi/thanos),
[Prometheus](https://hub.docker.com/hardened-images/catalog/dhi/prometheus), and
[Kafka](https://hub.docker.com/hardened-images/catalog/dhi/kafka).

Compatibility still needs to be checked per application.
A statically linked Go application with a simple entrypoint is usually easier to exchange than a database or JVM application that depends on startup scripts,
initialization steps, or a specific filesystem layout.

## Keep the upstream Helm chart

For Kubernetes, my preferred pattern is to keep the Helm chart from the software project or a community I already trust and only override the image when the chart supports it.

Conceptually, this can look like:

```yaml
image:
  repository: dhi.io/thanos
  tag: "0.42.4"
```

The exact values depend on the chart, but the separation is more important than the YAML.
The Helm chart still describes how the application runs, while the hardened image provider is responsible for packaging the application.

If I later decide to move back to the upstream image, the change should ideally be close to:

```yaml
image:
  repository: quay.io/thanos/thanos
  tag: "v0.42.4"
```

and not require a redesign of volumes, environment variables, probes, security contexts, or initialization logic.

I would also avoid switching to a catalog-specific Helm chart only because it bundles the hardened image.
If the existing upstream chart can consume another compatible image, keeping the chart and image provider separate makes a future migration much easier.

## What I would test before switching an image

An image override looks simple, but before using it in production I would verify at least the following points:

- Does the image use the same entrypoint and command-line arguments?
- Does it use the same UID/GID, or does the Pod security context need changes?
- Are the expected configuration and data paths identical?
- Are CA certificates and timezone data available when the application needs them?
- Does the application require a shell or helper binaries for probes or lifecycle hooks?
- Are startup, shutdown, and signal handling compatible?
- Does the image expose the same ports?
- Can I switch back to the upstream image by changing only the repository and tag?

The last question is my portability test.
If switching back only requires an image reference change, I am comfortable using a hardened catalog.
If it requires changes throughout the deployment, I want to understand that dependency before rolling it out across the platform.

## My rule of thumb

My current strategy is:

1. **Prefer an upstream minimal or distroless image when it exists.**
2. **If it does not exist, ask upstream whether they can provide one.**
3. **Use DHI or another hardened catalog when the application interface stays compatible.**
4. **Keep the upstream or trusted community Helm chart whenever possible.**
5. **Avoid catalog-specific entrypoints, environment variables, and filesystem layouts unless they provide a feature you actually need.**
6. **Make sure switching the image provider remains an image change rather than an application migration.**

Docker Hardened Images are a useful option, and making the community catalog free and open under Apache 2.0 is a positive move.
For me, the important lesson from Bitnami is not to avoid third-party images, but to make sure that a third-party image catalog does not become part of the application's API.

The image provider should be a replaceable implementation detail.
