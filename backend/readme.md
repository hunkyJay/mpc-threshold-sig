## Backend Server

This is the backend MPC process for key generation and transaction signing.

### Build

Download related modules

```go
$ go mod tidy
```

### Key Generation (If required)

Generate the private key and get the shares (indicating threshold) by MPC.

```go
$ cd keygen
$ go run key_gen.go
```



### Start the server

```go
$ cd sign_ethereum
$ go run main.go
```



