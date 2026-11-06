+++
title = "Kubernetes in your browser"
description = "A real Kubernetes control plane, compiled to WebAssembly: kube-apiserver, kube-controller-manager, kube-scheduler and kubectl run in your browser. Join a real node with docker and WebRTC."
+++

This is a real Kubernetes v1.37 control plane. Not a simulator. kube-apiserver, kube-controller-manager, kube-scheduler and kubectl are the upstream Go code, compiled to WebAssembly into one binary. The only replaced part is etcd: a small in-memory implementation of the etcd v3 API. Everything runs in your browser tab. Reload the page and the cluster is gone.

A control plane without nodes is boring. Type `join` and start the printed `docker run` command. The container runs a kubelet and containerd and connects to your browser with WebRTC. Then `kubectl get pods -A` shows flannel, kube-proxy and CoreDNS on a real node.

{{< kwasm >}}

The boot takes around 15 seconds. WebAssembly in the browser is single threaded, so the whole control plane shares one CPU core. The source is in the [blog repository](https://github.com/jkroepke/blog/tree/main/kwasm).
