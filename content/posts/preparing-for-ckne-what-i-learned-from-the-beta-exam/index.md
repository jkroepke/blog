+++
date = '2026-09-17T20:15:00+02:00'
title = 'Preparing for CKNE: What I Learned From the Beta Exam'
description = 'My experience with the new Certified Kubernetes Network Engineer beta exam, what I would prepare around Cilium, Istio, Gateway API, Kubernetes networking, and why time management matters.'
categories = ['Kubernetes']
tags = ['Kubernetes', 'CKNE', 'Cilium', 'Istio', 'Gateway API']
featuredImage = 'images/header.png'
+++

On September 17, I took the beta of the new **[Certified Kubernetes Network Engineer, CKNE](https://training.linuxfoundation.org/kubernetes-network-engineer-program/), exam**.
It was one of the hardest hands-on certification exams I have taken so far.
The challenge was not one extremely deep topic, but moving quickly across a broad Kubernetes networking stack within a two-hour time limit.

CKNE combines core Kubernetes networking with [Cilium](https://cilium.io/), [Istio](https://istio.io/), [Gateway API](https://gateway-api.sigs.k8s.io/), security, observability, and newer areas such as inference traffic.
Because the exam is still in beta, difficulty and timing may change before the final version.

## TL;DR

For CKNE preparation, focus on **[Cilium](https://cilium.io/) installation with the [Cilium CLI](https://docs.cilium.io/en/stable/gettingstarted/k8s-install-default/), L4 and L7 CiliumNetworkPolicy,
CiliumEgressGatewayPolicy, [Istio](https://istio.io/) PeerAuthentication and AuthorizationPolicy, [Kubernetes](https://kubernetes.io/) Services and EndpointSlices,
[Gateway API](https://gateway-api.sigs.k8s.io/), [cert-manager](https://cert-manager.io/), and the [Gateway API Inference Extension](https://gateway-api-inference-extension.sigs.k8s.io/) with InferencePool**.
Also be comfortable with [Prometheus](https://prometheus.io/), [Jaeger](https://www.jaegertracing.io/), and gateway access logs.

Do not spend too much time memorizing CRDs, complete YAML structures, Prometheus metric names, or complex PromQL.
For many advanced topics, context, documentation links, or the relevant observability signals are available.
Understand the problem, find the right reference, interpret the data, make the change, validate it, and move on.

## What to prepare before taking CKNE

The [public CKNE domains and competencies](https://training.linuxfoundation.org/certification/certified-kubernetes-network-engineer-ckne/) cover CNI, service networking, advanced traffic management, security, and observability.
Preparation should cover that breadth instead of going extremely deep into one product.

For **[Cilium](https://cilium.io/)**, focus on installation with the [Cilium CLI](https://docs.cilium.io/en/stable/gettingstarted/k8s-install-default/) and how CLI options map to Helm values.
The [Cilium Helm reference](https://docs.cilium.io/en/stable/helm-reference/) and [masquerading documentation](https://docs.cilium.io/en/stable/network/concepts/masquerading/) are useful references.
L4 and [L7 CiliumNetworkPolicy](https://docs.cilium.io/en/stable/security/policy/layer7/#allow-get-public) should be familiar, together with the purpose of [`CiliumEgressGatewayPolicy`](https://docs.cilium.io/en/stable/network/egress-gateway/egress-gateway/#example-policy).

For **[Istio](https://istio.io/)**, focus on workload security.
[`PeerAuthentication`](https://istio.io/latest/docs/reference/config/security/peer_authentication/) defines how workloads authenticate to each other, while [`AuthorizationPolicy`](https://istio.io/latest/docs/reference/config/security/authorization-policy/) controls which requests are allowed.
The important part is understanding authentication versus authorization, not memorizing every field.

## Do not forget the Kubernetes basics

Normal [Kubernetes](https://kubernetes.io/) networking still matters.
A broken `Service` may simply have the wrong `port` or `targetPort`, and understanding how Services discover their backends is fundamental.

Review [Services without selectors](https://kubernetes.io/docs/concepts/services-networking/service/#services-without-selectors).
Kubernetes does not create EndpointSlices automatically in this case, so the backend endpoints need to be created manually:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-api
spec:
  ports:
    - port: 443
      targetPort: 443
---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: external-api-1
  labels:
    kubernetes.io/service-name: external-api
addressType: IPv4
ports:
  - port: 443
endpoints:
  - addresses:
      - 192.0.2.10
```

The key details are the missing Service selector, the `kubernetes.io/service-name` label on the EndpointSlice, and the explicit backend address.

## Gateway API, cert-manager, and inference routing

For [Gateway API](https://gateway-api.sigs.k8s.io/), understand the relationship between `Gateway`, `HTTPRoute`, and the backend, and be able to trace how a request moves through those resources.

With [cert-manager](https://cert-manager.io/docs/usage/gateway/), know how a certificate ends up in a Secret and how a Gateway listener references that Secret.

The **[Gateway API Inference Extension](https://gateway-api-inference-extension.sigs.k8s.io/)** adds inference-aware routing for AI and LLM workloads.
Understand [`InferencePool`](https://gateway-api-inference-extension.sigs.k8s.io/api-types/inferencepool/) and why inference traffic may need more than normal Service load balancing.
The public CKNE blueprint explicitly includes **Optimizing LLM Traffic**.

## Documentation matters more than memorization

For Cilium, Istio, and Gateway API, memorizing complete YAML structures was not especially useful.
In the beta environment, enough context was available to identify the required resource, together with direct links to relevant documentation.

Practice finding the right example and adapting it quickly.
Knowing what a resource is supposed to achieve matters more than knowing every field from memory.

## Validation and observability

A useful part of the beta environment was being able to validate changes immediately instead of waiting until the end of the exam.

Troubleshooting was more UI-driven than I expected.
In my beta experience, I did not need low-level Linux tools such as `ip` or `tcpdump`.
Preinstalled [Prometheus](https://prometheus.io/) and [Jaeger](https://www.jaegertracing.io/) UIs were more relevant.
Provided metrics or traces can be used to identify slow, failing, or otherwise unhealthy services without memorizing metric names or writing complex PromQL from scratch.

Gateway access logs are worth understanding as well.
Be able to distinguish normal, rejected, and suspicious traffic and extract the relevant information quickly.

The [public CKNE blueprint](https://training.linuxfoundation.org/certification/certified-kubernetes-network-engineer-ckne/) includes network health metrics, distributed tracing, and auditing network traffic with logs.
For preparation, focus on navigating the tools, interpreting the provided data, identifying the problematic workload, and translating that finding into the appropriate Kubernetes action.

## Browser-based answers compared with CKA and CKS

If you have taken CKA or CKS before, you may remember tasks where a result had to be written into a file below `/opt`.
In the CKNE beta environment, textual results can also be entered through the browser-based exam interface, which then generates the required file.

## No exam simulator or dedicated training yet

CKNE is still too new to have the preparation ecosystem around CKA and CKS.
Those certifications include access to the **[Killer Shell](https://killer.sh/)** exam simulator for practicing the environment and time pressure.
Thanks to [Kim Wüstkamp](https://www.linkedin.com/in/kimwuestkamp/) for building it.

Killer Shell currently provides simulators for CKA, CKS, CKAD, CNPE, and LFCS, but there is no CKNE simulator yet.
I also could not find a dedicated CKNE training course from the Linux Foundation.
For now, most preparation comes directly from the Kubernetes, Cilium, Istio, and Gateway API documentation.

## Time was my biggest problem

Time was the hardest part for me.
Trouble with the in-browser desktop environment at the beginning also cost a few minutes.

Do not try to perfect one task.
Solve it, validate it, and move on.
If a task consumes too much time, return to it later.
Fast navigation through Kubernetes resources, documentation, and [`kubectl`](https://kubernetes.io/docs/reference/kubectl/) matters almost as much as knowing the concepts.

## Beta pricing

I paid **€57.94** using the 35% discount code `SEPT26BTS35CT`, which I found through the [Linux Foundation coupon collection maintained by TechiesCamp](https://github.com/techiescamp/linux-foundation-coupon).

The [Linux Foundation CKNE page](https://training.linuxfoundation.org/certification/certified-kubernetes-network-engineer-ckne/) currently marks new beta registrations as closed.
Pricing and available discounts may change once CKNE leaves beta.

## Conclusion

CKNE rewards breadth more than memorization.
You need to move between Kubernetes networking, Cilium, Istio, Gateway API, security, and observability, use the available documentation and tools efficiently, and troubleshoot under time pressure.
