export const PULUMI_PREVIEW_LOGS = [
  "Previewing update (dev)",
  "",
  "     Type                 Name             Plan",
  " +   pulumi:pulumi:Stack  aws-eks-dev      create",
  " +   └─ aws:eks:Cluster   main             create",
  " ",
  "Resources:",
  "    + 2 to create",
  "",
  "Do you want to perform this update? yes"
];

export const PULUMI_UP_LOGS = [
  "Updating (dev)",
  "",
  "     Type                 Name             Plan",
  " +   pulumi:pulumi:Stack  aws-eks-dev      create",
  " +   └─ aws:eks:Cluster   main             create",
  " ",
  "Resources:",
  "    + 2 created",
  "",
  "Duration: 10s"
];

export const AWS_CLI_LOGS = [
  "$ aws eks update-kubeconfig --region us-east-1 --name atlas-train-govcloud",
  "Added new context arn:aws:eks:us-east-1:123456789012:cluster/atlas-train-govcloud to /root/.kube/config",
  "",
  "$ kubectl get nodes",
  "NAME                             STATUS   ROLES    AGE   VERSION",
  "ip-192-168-1-1.ec2.internal      Ready    <none>   45s   v1.29.0-eks-5e0fd1",
  "ip-192-168-1-2.ec2.internal      Ready    <none>   45s   v1.29.0-eks-5e0fd1",
  "ip-192-168-1-3.ec2.internal      Ready    <none>   45s   v1.29.0-eks-5e0fd1",
  "",
  "$ kubectl get pods -A",
  "NAMESPACE     NAME                       READY   STATUS    RESTARTS   AGE",
  "kube-system   aws-node-5j8k2             1/1     Running   0          30s",
  "kube-system   coredns-79d589584d-8k7l2   1/1     Running   0          35s",
  "kube-system   kube-proxy-9l2k4           1/1     Running   0          30s"
];

export const HEALTH_CHECKS = [
  {
    id: 'network',
    label: 'VPC Networking',
    status: 'pass',
    detail: 'Subnets associated with route tables'
  },
  {
    id: 'gpu',
    label: 'GPU Availability',
    status: 'pass',
    detail: '4x H100 instances provisioned'
  },
  {
    id: 'storage',
    label: 'EBS CSI Driver',
    status: 'pass',
    detail: 'StorageClass gp3 is default'
  },
  {
    id: 'auth',
    label: 'IAM Authenticator',
    status: 'pass',
    detail: 'ConfigMap aws-auth updated'
  }
];
