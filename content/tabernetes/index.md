+++
title = "Tabernetes: Kubernetes in your browser tab"
# The page was /kubernetes/ before.
aliases = ["/kubernetes/"]
description = "A real Kubernetes control plane, compiled to WebAssembly: kube-apiserver, kube-controller-manager, kube-scheduler and kubectl run in your browser. Join a real node with Docker and WebRTC."
# wget in the terminal downloads with fetch(), so this page may connect anywhere.
cspConnectSrc = ["*"]
+++

Tabernetes is a real Kubernetes v1.37 control plane. Not a simulator. kube-apiserver, kube-controller-manager, kube-scheduler and kubectl are the upstream Go code, compiled to WebAssembly into one binary. The only replaced part is etcd: a small in-memory implementation of the etcd v3 API. Everything runs in your browser tab. Reload the page and the cluster is gone.

A control plane without nodes is boring. Type `join` and start the printed `docker run` command. The container runs a kubelet and containerd and connects to your browser with WebRTC. Then `kubectl get pods -A` shows flannel, kube-proxy and CoreDNS on a real node.

And yes, it runs Doom. After a join, type `doom`. [KubeDoom](https://github.com/storax/kubedoom) starts on the node, and every pod in the default namespace is a monster. Shoot one, and KubeDoom deletes the pod. The Deployment brings it back, of course.

Your browser tab can be a node, too. Type `llm`, and the tab joins its own cluster as the node `tab-1` and runs a language model as a pod on your GPU, with [WebLLM](https://webllm.mlc.ai) and WebGPU. `kubectl exec llm -- chat "What is a pod?"` asks it directly. This needs Chrome or Edge, and the first start downloads about 1 GB of model weights.

{{< tabernetes >}}

The boot takes around 15 seconds. WebAssembly in the browser is single threaded, so the whole control plane shares one CPU core. The source is in the [blog repository](https://github.com/jkroepke/blog/tree/main/tabernetes).
