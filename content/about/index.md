+++
title = "About Jan-Otto Kröpke"
description = "About Jan-Otto Kröpke, also known as Joe, Principal Cloud Architect writing about Kubernetes, cloud-native infrastructure, observability, platform engineering, and open source."
+++

I'm **Jan-Otto Kröpke**, a Principal Cloud Architect focused on Kubernetes, cloud-native infrastructure, observability, platform engineering, and open source.

I have been building and running infrastructure for more than eleven years. I started with Linux servers and classic monitoring, and today I spend most of my time on Kubernetes platforms, GitOps, and making sure people can actually see what their systems are doing.

I use this blog to share technical notes, experiments, lessons learned, and first-hand experience from the systems and projects I work with. Expect opinions. If something in our industry is overrated, I will say so.

## What I do

**I build internal developer platforms.** Right now, that means a Kubernetes-based IDP with Crossplane as the foundation. Developers should get a database, a bucket, or a whole environment through an API, not through a ticket. If a team has to wait three days for a namespace, the platform has failed.

**I make systems observable.** Prometheus, Grafana, and Thanos are my daily tools. I design monitoring stacks, write alerts that wake people up only when it matters, and delete dashboards nobody reads.

**I move workloads between worlds.** On-premise to cloud, Rancher and OpenShift to AKS, and sometimes into air-gapped networks where pulling a container image becomes a project of its own. Hybrid setups are messy, and I like making them less messy.

**I turn infrastructure into self-service.** Terraform frameworks, GitOps with FluxCD and Argo CD, and pipeline templates that let teams ship without asking the platform team for permission every time.

**I fix things upstream.** When a tool I use is broken, I open a pull request instead of a workaround. More on that below.

I do this as a Principal Cloud Architect at QualityOperations GmbH. Before that, I worked at CLOUDETEER, adorsys, noris network, and event it, where I started with an apprenticeship and learned the basics that still matter most: Linux, networking, and running things in production at 3 a.m.

## What I believe

- **Upstream first.** If a tool is broken, fix it upstream. A private fork is technical debt with a nice name.
- **Platforms are products.** A platform team that only hands out YAML templates is a ticket queue. Build self-service, or do not call it a platform.
- **Observability is not a dashboard collection.** If nobody looks at a panel during an incident, delete it.
- **Boring technology wins.** Prometheus, Terraform, and plain Helm charts are not exciting. They are reliable, and that is the point.
- **Certifications are a baseline, not a proof.** They show you know the API. Production shows if you know the system.

## Open source

Most of my free engineering time goes into open source. I'm a **Grafana Champion** and contribute to Prometheus, Grafana, and Terraform. I also maintain a few projects of my own:

- [helm-secrets](https://github.com/jkroepke/helm-secrets): a Helm plugin to manage secrets in your charts and values files.
- [openvpn-auth-oauth2](https://github.com/jkroepke/openvpn-auth-oauth2): OAuth2/OIDC single sign-on for OpenVPN, because static VPN credentials should have died years ago.

I care about security, too. I discovered [CVE-2023-5044](https://nvd.nist.gov/vuln/detail/CVE-2023-5044), a code injection vulnerability in ingress-nginx.

## Certifications

- Microsoft Certified: Azure Administrator Associate (AZ-104)
- Linux Foundation Certified Systems Administrator (LFCS)
- Certified Kubernetes Security Specialist (CKS)
- Certified Kubernetes Administrator (CKA)

## Outside of work

I live near Hannover, Germany, and volunteer at the **THW** (Technisches Hilfswerk), the German federal agency for technical relief. It is a good reminder that real incidents do not come with a runbook either.

## FAQ

### Who is Joe?

**Joe** comes from **J**an-**O**tto. I took the **J** from Jan and the **O** from Otto, and eventually canonicalized it to **Joe**.

It is the short name I commonly use online and in everyday communication.

### Where can I find you?

You can find my open-source work on [GitHub](https://github.com/jkroepke) and my professional profile on [LinkedIn](https://www.linkedin.com/in/jkroepke/).
