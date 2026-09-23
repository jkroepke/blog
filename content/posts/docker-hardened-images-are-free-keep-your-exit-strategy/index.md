+++
date = '2026-09-23T15:30:00+02:00'
title = 'Docker Hardened Images Are Free. Keep Your Exit Strategy'
description = 'Docker Hardened Images are free and Apache 2.0, but platform teams should still prefer upstream distroless images and keep hardened image providers replaceable.'
categories = ['Containers']
tags = ['Docker', 'Container Security', 'Distroless', 'Kubernetes', 'Supply Chain']
+++

After the changes around the Bitnami container catalog, many platform teams started looking for alternatives.
At the same time, [Docker Hardened Images (DHI)](https://www.docker.com/products/hardened-images/) became very attractive:
the full community catalog is free, published under Apache 2.0, and provides minimal images, SBOMs, provenance, and a very small CVE surface.

I like this direction.

But I think the Bitnami change should teach us something beyond which catalog to use next:

**Do not make an image catalog part of your application's API unless you really need to.**

Today DHI has a much better portability story than the old Bitnami model.
That does not remove the need for an exit strategy.

## What happened with Bitnami

In 2025, Bitnami changed how its public catalog works.

Existing versioned images were moved to the
[Bitnami Legacy repository](https://github.com/bitnami/charts/issues/35164), which receives no further updates or support.
The free community catalog was reduced, while production users needing continued updates, version history, and support were directed to the commercial Bitnami Secure Images offering.

The source code for the images and Helm charts remained available under Apache 2.0.

This is an important detail.

The problem was not simply that the source became closed.
The operational dependency was on the built images, registry, tags, update process, and the behavior inside those images.

For many users, replacing a Bitnami image was also not just changing:

```text
bitnami/foo -> another-registry/foo
```

Bitnami images often provided their own initialization logic, environment variables, filesystem conventions, and startup scripts.
The [Bitnami PostgreSQL image](https://github.com/bitnami/containers/blob/main/bitnami/postgresql/README.md), for example,
defines Bitnami-specific variables such as `POSTGRESQL_VOLUME_DIR`, `POSTGRESQL_DATA_DIR`, and other initialization behavior.

Once a Helm chart or deployment depends on these details, the image is no longer only a packaging choice.
It becomes part of the application interface.

Changing the provider then becomes a migration project.

## DHI is not simply "Bitnami again"

It would be unfair to say that Docker Hardened Images are the same model.

Docker currently publishes the complete DHI Community catalog for free under the
[Apache 2.0 license](https://docs.docker.com/dhi/).
The images are based on open distributions such as Debian and Alpine.
Docker also clearly separates the free catalog from commercial features such as SLA-backed remediation,
compliance variants, customization, and extended lifecycle support.

That is a good starting point.

The open license also gives users more options to use, share, mirror, and build on the catalog than a closed distribution model would.

Still, nobody can predict how a vendor's products, hosting, pricing, or distribution strategy will look in five years.

My conclusion is therefore not:

**Do not use DHI.**

It is:

**Use DHI in a way that keeps DHI replaceable.**

## Ask upstream first

Before replacing every container image with an image from a hardened catalog,
I would first ask the software vendor or open source project:

**Can you provide a minimal or distroless image yourself?**

For many applications, especially statically linked Go applications, this can be a relatively small change.
If the application can run without a shell, package manager, and general-purpose operating system utilities,
the upstream project can often provide a very small runtime image itself.

This is my preferred solution.

The image then stays part of the same release process as the software.
There is no additional organization between the project producing the binary and the image that I deploy.

For example, I opened requests for minimal or distroless images in:

- [thanos-io/thanos#8961](https://github.com/thanos-io/thanos/issues/8961)
- [prometheus-operator/prometheus-operator#8748](https://github.com/prometheus-operator/prometheus-operator/issues/8748)

Grafana already shows what this can look like.
The official Grafana images now have
[Alpine, Ubuntu, and Distroless variants](https://github.com/grafana/grafana/blob/main/docs/sources/setup-grafana/configure-docker.md),
including tags such as:

```text
grafana/grafana:<version>-distroless
grafana/grafana:<version>-distroless-slim
```

In this case, I do not need DHI just to get a distroless Grafana image.
The upstream project already provides one.

## When I would use DHI

There are many cases where I would still use Docker Hardened Images.

The important question is not whether the image comes from Docker.

The important question is:

**Can I replace the image provider without changing the application configuration?**

For a simple application that starts one binary with normal command-line flags,
uses the same paths, user model, and network ports as upstream,
and does not depend on provider-specific initialization,
a hardened image can be a very good replacement.

DHI already contains images for projects such as
[Thanos](https://hub.docker.com/hardened-images/catalog/dhi/thanos),
[Prometheus](https://hub.docker.com/hardened-images/catalog/dhi/prometheus), and
[Kafka](https://hub.docker.com/hardened-images/catalog/dhi/kafka).

But compatibility should be tested per application.
A Go binary with a simple entrypoint is usually easier to exchange than a database or JVM application with startup scripts,
initialization steps, or filesystem assumptions.

## Keep the upstream Helm chart

My preferred Kubernetes pattern is to keep the Helm chart from the software project or the community I already trust,
and override only the image when that chart supports it.

Conceptually:

```yaml
image:
  repository: dhi.io/thanos
  tag: "0.42.4"
```

The exact values depend on the chart, but the architectural idea is more important than the YAML.

The Helm chart still defines how the application runs.

The application's configuration still follows the upstream interface.

The hardened image provider is only responsible for packaging the application.

If I later decide to move back to the upstream image, the desired change should be closer to:

```yaml
image:
  repository: quay.io/thanos/thanos
  tag: "v0.42.4"
```

and not a complete redesign of volumes, environment variables, probes, security contexts, or initialization logic.

I would also avoid switching to a catalog-specific Helm chart only because it bundles the hardened image.
If the existing chart can consume another compatible image, keeping that separation reduces the migration surface.

## What I would test before switching an image

An image override looks simple, but I would verify at least these points before using it in production:

- Does the image use the same entrypoint and command-line arguments?
- Does it use the same UID/GID or does the Pod security context need changes?
- Are the expected configuration and data paths identical?
- Are CA certificates and timezone data available when the application needs them?
- Does the application require a shell or helper binaries for probes or lifecycle hooks?
- Are startup, shutdown, and signal handling identical?
- Does the image expose the same ports?
- Can I switch back to the upstream image by changing only the repository and tag?

That last question is my portability test.

If the answer is yes, I am comfortable using a hardened catalog.

If the answer is no, I want to understand which provider-specific behavior I am adopting before I roll it out across the platform.

## My rule of thumb

My current strategy is:

1. **Prefer an upstream minimal or distroless image when it exists.**
2. **If it does not exist, ask upstream whether they can provide one.**
3. **Use DHI or another hardened catalog when the application interface stays compatible.**
4. **Keep the upstream or trusted community Helm chart whenever possible.**
5. **Avoid catalog-specific entrypoints, environment variables, and filesystem layouts unless they provide a feature you actually need.**
6. **Make sure switching the image provider is an image change, not an application migration.**

Docker Hardened Images are a useful option, and making the catalog free and open under Apache 2.0 is a positive move.

But "free today" should not be the architecture.

The architecture should be that the image provider is replaceable.

For me, that is the most important lesson from Bitnami:
**the problem is not using a third-party image catalog; the problem starts when the catalog becomes part of your application's API.**
