# security-rbac-tests
A collection of test cases to test Role Based Access Control (RBAC) feature in mojaloop

### Run tests locally
1. Connect to any required VPN

2. Set the relevant kubeconfig. This is only required for the port-forward, not for the tests
   themselves.
```sh
export KUBECONFIG=/path/to/relevant/kube/config.yaml
```

3. Port-forward the role assignment service
```sh
kubectl port-forward -n mojaloop deploy/bof-role-assignment-service 3008
```

4. Change to the test directory
```sh
cd tests/rbac
```

5. Install dependencies
```sh
npm ci
```

6. Run tests:
```sh
npm t
```

### Config
Configured via shell environment. See [config.ts](./test/config.ts).
