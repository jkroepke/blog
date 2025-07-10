+++
date = '2025-08-09T21:12:46+02:00'
draft = true
title = 'Multi Node Kubernetes on a Single Node'
description = ''
categories = ['Kubernetes']
tags = ['Kubernetes', 'HomeLab', 'LXD', 'kubeadm']
+++

For people who run homelabs, getting enough resources often proves difficult. Still, many want a multi-node Kubernetes setup. Tools like [Kind](https://kind.sigs.k8s.io/), [K3s](https://k3s.io/), and [K0s](https://k0sproject.io/) help with this. They create control planes and worker nodes in seconds. But these tools offer little learning about the system's inner workings.

This blog post shows how to set up lasting control planes and worker nodes using [LXD](https://canonical.com/lxd). The method uses [**kubeadm**](https://kubernetes.io/docs/reference/setup-tools/kubeadm/) to build a **basic Kubernetes cluster**. This setup requires manual installation of network and storage drivers. LXD uses the same key computer parts as Docker. This means no extra virtual machine weight, which helps make this setup efficient on just one machine.

## Prerequisites

* A computer with at least 4 GB of RAM and 4 CPU cores.
* Ubuntu 22.04 or later.
