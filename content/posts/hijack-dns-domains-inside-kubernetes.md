+++
date = '2025-07-09T21:12:46+02:00'
title = 'DNS Hijacking in Kubernetes'
description = 'Kubernetes DNS, while convenient, harbors a security risk: a lack of understanding regarding its resolution mechanisms permits attackers to redirect cluster traffic without exploits, simply by creating specific namespaces and services. Effective protection hinges on policy, strict naming conventions, controlled permissions, and egress restrictions.'
categories = ['Kubernetes']
tags = ['DNS', 'Kubernetes', 'Security']
+++

Kubernetes DNS provides a streamlined way for pods to discover one another using short, user-friendly names,
keeping complex IP addresses out of sight.
Yet, this very convenience can mask a significant security flaw. Without a thorough grasp of Kubernetes DNS behavior, an opening for attackers might unknowingly be created.
Consider this: the ability to create namespaces and services allows an attacker to reroute traffic intended to leave a cluster, diverting it for their own purposes.

## How DNS Resolution Works in Kubernetes

There are three parts involved in this behavior:

* The pod’s `resolv.conf` file
* The ndots option
* The DNS search path

A typical pod's `resolv.conf` configuration often appears as follows:

```text
nameserver 10.96.0.10
search default.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

When a pod attempts to resolve a domain, such as `example.com`, the resolver notes only a single dot within the name.
Because the `ndots` option is set to `5`, this name is not immediately treated as fully qualified.
Instead, the resolver begins by appending domains from its configured search path.
This process constructs and attempts to resolve the following in sequence:

1. `example.com.<pod-namespace>.svc.cluster.local`
2. `example.com.svc.cluster.local`
3. `example.com.cluster.local`

Should any of these internally constructed names resolve to an existing internal service within the cluster,
that internal result governs the connection.
Consequently, the intended external example.com receives no contact.
This precisely defines the point where the traffic redirection, or "hijack," can commence.

## Redirecting Traffic Through Kubernetes DNS

This attack scenario unfolds simply, requiring only two steps.

### First, Observe the Default Behavior

Execute the following command:

```bash
kubectl run --rm -ti --image=alpine dns-test -- wget http://example.com -qO-
```

The response originates from the authentic external domain:

```html
<!doctype html>
<html>
  <head><title>Example Domain</title></head>
  ...
</html>
```

### Next, Prepare the Attack

Create a namespace named `com` and a service named `example`. This service directs traffic to an unexpected endpoint:

```bash
kubectl create namespace com

kubectl create service externalname example \
  --namespace com \
  --external-name=wttr.in
```

This command creates a service of type [`ExternalName`](https://kubernetes.io/docs/concepts/services-networking/service/#externalname). 
This particular service type offers a way to link a name inside Kubernetes to an external DNS address. 
It functions like a special pointer, like a [CNAME record](https://en.wikipedia.org/wiki/CNAME_record) in standard DNS.

Crucially, this service type does not process or proxy any traffic itself. 
It directs other components within the cluster where to send requests for the given name. 
In this attack scenario, the service named `example` directs traffic,
originally seeking `example.com`, to the `wttr.in` endpoint instead.

### Run the Same Command Again

```bash
kubectl run --rm -ti --image=alpine dns-test -- wget http://example.com -qO-
```

This time, the result no longer corresponds to the example domain.
Instead, it presents the weather forecast from `wttr.in`.

```
Weather report: Frankfurt am Main, Germany

     \  /       Partly cloudy
   _ /"".-.     +22(24) °C
     \_(   ).   ↘ 7 km/h
     /(___(__)  10 km
                0.0 mm
```

So what happened?

* The resolver did not interpret `example.com` as a complete address.
* It subsequently attempted to resolve `example.com.svc.cluster.local`.
* Given that name now held validity, the request routed inside the cluster.
* The pod perceived itself as reaching an external service, yet its communication never exited the cluster boundaries.

## How To Protect Your Cluster

Addressing this vulnerability does not involve a simple patch.
Instead, robust control requires a combination of stringent policy and heightened awareness.

Effective strategies include:

* **Securing External Connections with HTTPS:** Of course, consistently employing HTTPS for external connections secures the data payload. This practice encrypts communication and validates server identity, thereby mitigating man-in-the-middle attack consequences even when traffic redirection occurs.

* **Prohibiting Namespace Names Matching Top-Level Domains:**
  Implement admission controllers, such as [Kyverno](https://kyverno.io/) or 
  a [builtin ValidatingAdmissionPolicy](https://gist.github.com/jkroepke/e75b403388389bed6913fb1bc6927ed7),
  to reject namespace names that parallel top-level domains like `com`, `org`, `io`, and similar designations.

* **Mandating Fully Qualified Domain Names in Applications:** Always append a trailing dot to domain names within applications. For instance, employ `example.com.`. This explicit addition signals to the resolver that the name stands complete, preventing any further appending of search path elements.

* **Limiting Namespace Creation Permissions:** Grant permissions for namespace creation sparingly, restricting this capability to trusted users and automated systems. Many deployments do not necessitate this privilege outside of platform automation processes.

* **Restricting Egress Traffic with Network Policies:** Establish a default stance of denying all outgoing traffic. Subsequently, explicitly permit connections only to verified destinations, specifying them by IP address or fully qualified domain name.

## Concluding Remarks

Kubernetes DNS offers significant power and straightforward operation;
however, that very simplicity sometimes presents a vulnerability.
A thorough understanding of how names resolve within a cluster proves essential.
Without such comprehension, an attacker exploits these default behaviors, redirecting traffic in unforeseen ways.

Any individual possessing the ability to create a namespace,
and a service gains the means to interpose their infrastructure between a pod and the internet.
Significantly, they achieve this without requiring a single exploit.
