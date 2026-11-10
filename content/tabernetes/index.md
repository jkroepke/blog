+++
title = "Tabernetes: Kubernetes in your browser tab"
# The page was /kubernetes/ before.
aliases = ["/kubernetes/"]
description = "A real Kubernetes control plane, compiled to WebAssembly: kube-apiserver, kube-controller-manager, kube-scheduler and kubectl run in your browser. Join a real node with Docker and WebRTC."
# wget in the terminal downloads with fetch(), so this page may connect anywhere.
cspConnectSrc = ["*"]
+++

Tabernetes is a real Kubernetes v1.37 control plane. Not a simulator. kube-apiserver, kube-controller-manager, kube-scheduler and kubectl are the upstream Go code, compiled to WebAssembly into one binary. The only replaced part is etcd: a small in-memory implementation of the etcd v3 API. Everything runs in your browser tab. Reload the page and the cluster is gone.

Your browser tab is a node, too. The control plane runs in a shared worker, and every tab of this page joins the cluster as a node. Open the page in a second tab, and `kubectl get nodes` shows `tab-2`. Close the first tab, and the cluster keeps running, the node from `join` included: every tab has its own WebRTC connection to it.

Check it out:

{{< admonition type=example title="Run: join" open=false >}}
A control plane without nodes is boring. Type `join` and start the printed `docker run` command. The container runs a kubelet and containerd and connects to your browser with WebRTC. Then `kubectl get pods -A` shows flannel, kube-proxy and CoreDNS on a real node.
{{< /admonition >}}

{{< admonition type=example title="Run: kubectl run nginx" open=false >}}
Your tab runs real container images, too. Type `kubectl run nginx --image=nginx:alpine`. Without a node from `join`, the pod lands on your tab.
The tab pulls the image from Docker Hub, packs the layers into an initramfs and boots it with a small Linux kernel in [v86](https://github.com/copy/v86), an x86 emulator that compiles x86 code to WebAssembly. The serial console of the VM is the log of the container, so `kubectl logs nginx` works. `kubectl port-forward pod/nginx 8080:80` and `proxy 8080` show the nginx welcome page.

The emulated CPU is a 32-bit x86, so the image needs a `linux/386` variant. The official images like alpine, busybox and nginx have one. Docker Hub sends no CORS headers, so your tab pulls through a small registry mirror of mine. `kubectl exec` does not work (yet).
{{< /admonition >}}

{{< admonition type=example title="Run: doom" open=false >}}
And yes, it runs Doom. After a join, type `doom`. [KubeDoom](https://github.com/storax/kubedoom) starts on the node, and every pod in the default namespace is a monster. Shoot one, and KubeDoom deletes the pod. The Deployment brings it back, of course.
{{< /admonition >}}

{{< admonition type=example title="Run: llm" open=false >}}
Type `llm`, and a Deployment runs a language model on the GPU of your tab, with [WebLLM](https://webllm.mlc.ai) and WebGPU. The tab pulls the model like an image, and `kubectl describe pod` shows the events.
Then `kubectl exec -it deploy/llm -- chat` talks to it, or `kubectl port-forward deploy/llm 8000` and `proxy 8000` open a chat page. Close the tab, and the pod moves to another tab with WebGPU.

`llm` needs a browser with WebGPU, for example a current Chrome or Edge. The first start downloads about 1 GB of model weights from Hugging Face. After that, they come from the browser cache.
{{< /admonition >}}

{{< tabernetes >}}

The boot takes around 15 seconds. WebAssembly in the browser is single threaded, so the whole control plane shares one CPU core. The source is in the [blog repository](https://github.com/jkroepke/blog/tree/main/tabernetes).
