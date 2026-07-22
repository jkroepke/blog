+++
date = '2026-07-23T00:00:00+02:00'
title = 'Kubernetes Image Volumes for Platform-Managed Runtimes'
description = 'Kubernetes image volumes make it possible to separate application artifacts from their language runtimes. This brings back a responsibility model that was common before containers: application teams deliver applications, while platform teams maintain and patch the runtime.'
categories = ['Kubernetes']
tags = ['Containers', 'Kubernetes', 'Platform Engineering', 'Security']
+++

Since Kubernetes v1.36, [image volumes](https://kubernetes.io/docs/tasks/configure-pod-container/image-volumes/) are stable. They allow Kubernetes to pull an OCI image or artifact and mount its filesystem into a container. At first glance, this looks like a small storage feature, but it enables a much more interesting concept: **platform-managed runtimes**.

In this model, the application team publishes the application artifact, while the platform team provides and maintains the environment required to run it. Kubernetes combines both when the Pod starts, so the application team no longer needs to package Java, operating system libraries, and CA certificates into every application image.

In my view, image volumes add a lightweight PaaS-style runtime layer to Kubernetes. Developers provide the application, while the platform provides the runtime, security patches, and rollout process. This does not require a large and hard-to-maintain ecosystem of buildpacks, custom resources, operators, or dedicated deployment APIs. The model continues to use standard Kubernetes Deployments, OCI registries, health probes, and rolling updates.

The concept itself is not new. Before containers and Kubernetes became common, operations teams maintained operating systems and language runtimes, while application teams deployed JARs, WARs, or other application artifacts onto these prepared environments.

Containers improved this model by packaging the application and its complete userspace into one reproducible image. At the same time, they moved responsibility for operating system libraries and language runtimes into every application team. Image volumes make it possible to separate these responsibilities again without returning to mutable servers or giving up the container delivery model.

## From Operations-Managed Runtimes to Application Images

Before Kubernetes, a Java runtime was commonly treated as part of the operating environment. Operations installed and maintained the operating system, system libraries, CA certificates, and Java, while the application team delivered an application artifact.

During patch days, operations could update both the operating system and Java without requiring a new release of every application. The responsibility model was clear: application teams maintained applications, while operations maintained operating systems and runtimes.

The technical implementation was not always great, of course. Servers could drift apart, different stages could use different versions, and changes could happen directly on long-running systems. Reproducing the exact production environment was often difficult.

Containers solved many of these problems by packaging an application together with its complete userspace. A typical Java application image now contains operating system libraries, CA certificates, the Java runtime, the application itself, and all application dependencies.

This creates a reproducible artifact that can move through development, testing, and production. However, the ownership of those dependencies moved as well.

When an application team selects a base image, it becomes responsible not only for its application and Maven dependencies, but also for the operating system packages, Java runtime, CA certificates, and lifecycle of the base image.

In practice, this responsibility is often difficult to handle. Application teams receive vulnerability findings for operating system packages they did not directly select and may not understand. When a critical Java vulnerability appears, a new application image usually needs to be built, tested, approved, and deployed even though neither the application code nor its dependencies have changed.

A common Java Dockerfile looks like this:

```dockerfile
FROM eclipse-temurin:25-jre

COPY target/*.jar /app.jar

ENTRYPOINT ["java", "-jar", "/app.jar"]
```

This image combines two different artifacts: the application and the runtime required to execute it. Because they are packaged together, both share the same release cycle.

An application change requires a new image, but the same applies to a Java runtime update or operating system security patch. In a company with hundreds of Java applications, the same or a very similar runtime is therefore copied into hundreds of independently maintained application images.

This is where platform-managed runtimes become interesting again. A platform team should be able to provide and patch a supported Java runtime without requiring every application team to rebuild unchanged application code.

## Separating the Application from the Runtime

An [image volume](https://kubernetes.io/docs/concepts/storage/volumes/#image) represents an OCI image or artifact whose filesystem is mounted read-only into a container. The normal container image can therefore provide the runtime, while the image volume provides the application. Kubernetes resolves the volume when the Pod starts and uses the existing image-pull mechanisms to retrieve it from an OCI registry.

The application team can package the JAR in an OCI image based on `scratch`:

```dockerfile
FROM scratch

COPY target/*.jar /app.jar
```

The resulting artifact does not contain Java, an operating system, a shell, or a package manager. It contains only the application:

```text
/app.jar
```

This image is not intended to run as a standalone container. It is a filesystem artifact distributed through an OCI registry and mounted into a separate runtime container.

Using `FROM scratch` makes the responsibility boundary clear: the application artifact belongs to the application team and contains only the application.

The platform team provides the Java runtime image, and the Deployment combines both artifacts:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app.kubernetes.io/name: oci-image-demo
  name: oci-image-demo
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: oci-image-demo
  template:
    metadata:
      labels:
        app.kubernetes.io/name: oci-image-demo
    spec:
      containers:
        - name: oci-image-demo
          image: docker.io/library/eclipse-temurin:25-jre
          command:
            - java
          args:
            - -jar
            - /app/app.jar
          ports:
            - containerPort: 8080
              name: http
          livenessProbe:
            httpGet:
              port: http
              path: /actuator/health/liveness
          readinessProbe:
            httpGet:
              port: http
              path: /actuator/health/readiness
          resources:
            limits:
              memory: 256Mi
            requests:
              memory: 128Mi
              cpu: 100m
          volumeMounts:
            - name: app
              mountPath: /app
      volumes:
        - name: app
          image:
            reference: ghcr.io/jkroepke/oci-image-demo:latest
            pullPolicy: IfNotPresent
```

The runtime image provides the operating system libraries, CA certificates, Java runtime, and `java` executable. The image volume adds `/app/app.jar`.

When the container starts, it executes:

```text
java -jar /app/app.jar
```

Both artifacts are combined inside the container, but they remain separate OCI objects with different owners and release cycles.

## A New Version of an Old Responsibility Model

The responsibility model becomes similar to the time before containers, but the implementation remains immutable and reproducible.

The application team continues to own the source code, application dependencies, build process, tests, and application artifact. It also defines the required Java version and verifies compatibility with the runtimes offered by the platform.

If the JAR contains a vulnerable version of Spring Boot, Netty, Log4j, or another library, the application team still needs to update and release it. Image volumes do not move all security responsibility to the platform team.

The platform team owns the runtime image, including the Java distribution, operating system libraries, CA certificates, hardening, vulnerability handling, and support lifecycle. Instead of every application team maintaining its own Java base image, the platform can provide a small catalog of supported runtimes:

```text
company.example/runtime/java:21
company.example/runtime/java:25
```

These runtimes become platform products with a documented contract, patch process, and support lifecycle.

## Runtime Patches Become Platform Rollouts

Assume a company operates 500 Java applications and a critical vulnerability is discovered in the shared Java runtime.

With traditional application images, every affected repository may need to rebuild its image, execute its delivery pipeline, publish a new version, update the deployment, and roll out the result. This work is repeated even though neither the application code nor its dependencies have changed.

With platform-managed runtimes, the application artifacts can remain unchanged. The platform team publishes a patched runtime image and triggers a [rolling update](https://kubernetes.io/docs/tasks/run-application/update-deployment-rolling/) of the affected workloads, turning the runtime patch into a platform rollout rather than hundreds of independent application releases.

With suitable rollout settings and [startup and readiness probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/), an incompatible runtime stalls the Deployment before it replaces all healthy replicas. An application-specific smoke test can be executed through a `startupProbe`, so the incompatibility is detected before the Pod becomes ready and the rollout progresses.

Kubernetes does not automatically roll back a failed Deployment, so the platform still needs monitoring and automation to detect a stalled rollout and restore the previous runtime. However, the updated runtime can be tested against real application instances while Pods using the previous immutable runtime continue serving traffic.

## This Is Not a Return to Mutable Servers

At first, this concept may sound like a return to application servers: operations provides Java, and developers provide a JAR.

The important difference is immutability.

Traditional server environments were often updated directly, which meant that their exact state could change over time. Platform-managed runtimes with image volumes keep the container model: the runtime is an immutable OCI image, and the application is an immutable OCI artifact.

Both have explicit versions, can be scanned and signed, can move through different stages, and can be rolled back independently. Every Pod starts with a defined combination of runtime and application, without a shared application directory or manually patched Java installation.

**The old responsibility model returns without the old deployment model.**

## The Runtime Becomes a Platform Contract

A platform-managed runtime needs a clear contract so that application teams can reliably build and test against it. For Java, this may include the supported major versions, runtime vendor, base operating system, CA certificates, CPU architectures, runtime flags, and patch timelines.

The platform team should not silently replace Java 21 with Java 25 or change important runtime behavior without a controlled migration. Platform-managed does not mean uncontrolled; it means that runtime ownership and lifecycle are managed centrally as a platform capability.

Although the application and runtime are released independently, their exact combination remains the deployable unit:

```text
application digest + runtime digest
```

This combination should be visible in deployment metadata, observability data, and incident reports so operators can determine exactly which application artifact ran with which runtime.

## Operational Considerations

Separating the application and runtime introduces a few additional requirements.

### Scan and Verify Both Artifacts

Security and inventory tools must inspect both the normal container image and the image volume reference. A tool that checks only:

```text
spec.containers[*].image
```

will miss application artifacts under:

```text
spec.volumes[*].image.reference
```

Vulnerability scanners, admission policies, software inventories, registry allowlists, and signature verification must therefore understand image volumes.

### Use Immutable References

The example uses `latest` for simplicity, but production environments should normally use versioned tags or digests:

```yaml
volumes:
  - name: app
    image:
      reference: ghcr.io/jkroepke/oci-image-demo@sha256:...
      pullPolicy: IfNotPresent
```

The runtime image should also use an immutable reference. It must always be possible to reproduce and roll back the exact application and runtime combination.

### Keep Compatibility Shared

The platform team can own the runtime, but it cannot assume that every application works with every runtime update. Application teams still need meaningful tests, while the platform needs staged rollouts, monitoring, and rollback automation.

The responsibilities are separated, but cooperation remains necessary.

## Conclusion

Platform-managed runtimes are not a new concept. Before containers, operations teams maintained operating systems and language runtimes, while application teams delivered their applications.

Containers improved reproducibility by packaging both into one image, but this also moved runtime maintenance into every application team. Kubernetes image volumes make it possible to separate these responsibilities again: the application team publishes an application-only OCI artifact, the platform team maintains the runtime image, and Kubernetes combines both when the Pod starts.

The result is a lightweight PaaS-style runtime layer built from standard Kubernetes components. Application teams can focus on application code and dependencies, while platform teams provide, harden, and patch standardized runtimes.

The complete example is available in the [oci-image-demo repository](https://github.com/jkroepke/oci-image-demo).
