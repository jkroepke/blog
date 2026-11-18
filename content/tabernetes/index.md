+++
title = "Tabernetes: Kubernetes in your browser tab"
# The page was /kubernetes/ before.
aliases = ["/kubernetes/"]
description = "A real Kubernetes control plane, compiled to WebAssembly: kube-apiserver, kube-controller-manager, kube-scheduler and kubectl run in your browser. Join a real node with Docker and WebRTC."
# wget in the terminal downloads with fetch(), so this page may connect anywhere.
cspConnectSrc = ["*"]
+++

Tabernetes is a real Kubernetes v1.37 control plane. Not a simulator. kube-apiserver, kube-controller-manager, kube-scheduler and kubectl are the upstream Go code, compiled to WebAssembly into one binary. The only replaced part is etcd: a small in-memory implementation of the etcd v3 API. Everything runs in your browser tab.

Reload the page, and your cluster is still there. The browser keeps what a control plane node keeps on its disk: the data of etcd and the certificates. The files in your home directory stay, too. Only the nodes are new, because the old tabs are gone, and your Deployments start their pods again. `forget` deletes all of it.

Your browser tab is a node, too. The control plane runs in a shared worker, and every tab of this page joins the cluster as a node. Open the page in a second tab, and `kubectl get nodes` shows `tab-2`. Close the first tab, and the cluster keeps running, the node from `join` included: every tab has its own WebRTC connection to it.

The kubelet of a tab is not the real one, though. It is a small one that I wrote for the browser, like a [Virtual Kubelet](https://virtual-kubelet.io/): for the control plane it is a node, but there is no container runtime behind it, only your tab.

Check it out:

{{< admonition type=example title="Run: join" open=false >}}
Your tabs are nodes already, but they run containers in an emulator. For a real node, type `join` and start the printed `docker run` command. The container runs a kubelet and containerd and connects to your browser with WebRTC. Then `kubectl get nodes` shows it next to your tabs, and `kubectl get pods -A` shows flannel, kube-proxy and CoreDNS on it.
{{< /admonition >}}

{{< admonition type=example title="Run: kubectl run nginx" open=false >}}
Your tab runs real container images, too. Type `kubectl run nginx --image=nginx:alpine`. Without a node from `join`, the pod lands on your tab.
The tab pulls the image from Docker Hub and boots a small Linux kernel in [v86](https://github.com/copy/v86), an x86 emulator that compiles x86 code to WebAssembly. The serial console of the VM is the log of the container, so `kubectl logs nginx` works.

The layers go to the storage of your browser, unpacked once, like `/var/lib/containerd` on a real node. The kernel mounts them over 9p as its root file system. So the image is not in the memory of the VM, even the Debian based `nginx` starts in a few seconds, and the next pull, in any tab or after a reload, is `already present on machine`.

`kubectl port-forward pod/nginx 8080:80 &` and `proxy 8080` show the nginx welcome page. The `&` keeps the port-forward in the background, as in a real shell.

The emulated CPU is a 32-bit x86, so the image needs a `linux/386` variant. The official images like alpine, busybox and nginx have one. Docker Hub sends no CORS headers, so your tab pulls through a small registry mirror of mine.

`kubectl exec -it nginx -- sh` gives you a shell in the container, and `kubectl run -it --rm alpine --image=alpine -- sh` does the same with a fresh pod that is gone after `exit`. And `wget -qO-` with the pod IP from `kubectl get pods -o wide` reaches nginx, even though the terminal is not in the pod network: the request goes through the port-forward of the apiserver.
{{< /admonition >}}

{{< admonition type=example title="Run: doom" open=false >}}
And yes, it runs Doom. After a join, type `doom`. [KubeDoom](https://github.com/storax/kubedoom) starts on the node, and every pod in the default namespace is a monster. Shoot one, and KubeDoom deletes the pod. The Deployment brings it back, of course.
{{< /admonition >}}

{{< admonition type=example title="Run: llm" open=false >}}
Type `llm`, and a Deployment runs a language model on the GPU of your tab, with [WebLLM](https://webllm.mlc.ai) and [WebGPU](https://webgpu.org/). The model is the image: `huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC`, the Hugging Face repository with its weights. The tab pulls it like an image, and `kubectl describe pod` shows the events.
Then `kubectl exec -it deploy/llm -- chat` talks to it, or `kubectl port-forward deploy/llm 8000 &` and `proxy 8000` open a chat page. Close the tab, and the pod moves to another tab with WebGPU.

`llm` needs a browser with WebGPU, for example a current Chrome or Edge. The first start downloads about 1 GB of model weights from Hugging Face. After that, they come from the browser cache.
{{< /admonition >}}

{{< tabernetes >}}

The boot takes around 15 seconds. WebAssembly in the browser is single threaded, so the whole control plane shares one CPU core. The source is on [GitHub](https://github.com/jkroepke/tabernetes).
