package main

import (
	// "bytes"
	"bufio"
	// "context"
	"crypto/ecdsa"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"

	// "github.com/lastingasset/tss-lib/common"
	tsscommon "github.com/lastingasset/tss-lib/common"
	"github.com/lastingasset/tss-lib/ecdsa/keygen"
	"github.com/lastingasset/tss-lib/ecdsa/signing"
	"github.com/lastingasset/tss-lib/test"
	"github.com/lastingasset/tss-lib/tss"
	"github.com/pkg/errors"
	"github.com/rs/cors"

	// "github.com/ethereum/go-ethereum/accounts/abi"
	// "github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	// "github.com/ethereum/go-ethereum/rpc"

	// "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	// "github.com/ethereum/go-ethereum/ethclient"
	// "github.com/stretchr/testify/assert"
)



const (
	testFixtureDirFormat  = "%s/../keygen/_fixtures"
	testFixtureFileFormat = "keygen_data_%d.json"
	rpcURL                = "http://localhost:7545"
)

func makeTestFixtureFilePath(partyIndex int) string {
	_, callerFileName, _, _ := runtime.Caller(0)
	srcDirName := filepath.Dir(callerFileName)
	fixtureDirName := fmt.Sprintf(testFixtureDirFormat, srcDirName)
	return fmt.Sprintf("%s/"+testFixtureFileFormat, fixtureDirName, partyIndex)
}


func LoadKeygenTestFixturesSet(qty int) ([]keygen.LocalPartySaveData, tss.SortedPartyIDs, error) {
	keys := make([]keygen.LocalPartySaveData, 0, qty)
	signed := make(map[int]bool)
	reader := bufio.NewReader(os.Stdin)

	for len(keys) < qty {
		fmt.Print("Please indicate the user id to sign (or type 'revoke <id>' to revoke a user): ")
		input, err := reader.ReadString('\n')
		if err != nil {
			fmt.Println("Error reading input. Please try again.")
			continue
		}

		input = strings.TrimSpace(input)

		if strings.HasPrefix(input, "revoke") {
			parts := strings.Split(input, " ")
			if len(parts) != 2 {
				fmt.Println("Invalid revoke command. Usage: revoke <id>")
				continue
			}
			id, err := strconv.Atoi(parts[1])
			if err != nil {
				fmt.Println("Invalid input. Please enter a numeric id.")
				continue
			}
			if _, exists := signed[id]; !exists {
				fmt.Println("User has not signed yet.")
				continue
			}
			delete(signed, id)
			// Remove the user's key from the keys list
			for i := 0; i < len(keys); i++ {
				if i == id {
					keys = append(keys[:i], keys[i+1:]...)
					break
				}
			}
			fmt.Printf("Revoked signature for user %d.\n\n", id)
			continue
		}

		id, err := strconv.Atoi(input)
		if err != nil {
			fmt.Println("Invalid input. Please enter a numeric id.")
			continue
		}
		if id < 0 {
			fmt.Println("Invalid id. Please enter a valid user id within the range.")
			continue
		}
		if _, exists := signed[id]; exists {
			fmt.Println("User has already signed.")
			continue
		}

		fixtureFilePath := makeTestFixtureFilePath(id)
		bz, err := ioutil.ReadFile(fixtureFilePath)
		if err != nil {
			return nil, nil, errors.Wrapf(err,
				"could not open the test fixture for party %d in the expected location: %s. run keygen tests first.",
				id, fixtureFilePath)
		}
		var key keygen.LocalPartySaveData
		if err = json.Unmarshal(bz, &key); err != nil {
			return nil, nil, errors.Wrapf(err,
				"could not unmarshal fixture data for party %d located at: %s",
				id, fixtureFilePath)
		}
		for _, kbxj := range key.BigXj {
			kbxj.SetCurve(tss.S256())
		}
		key.ECDSAPub.SetCurve(tss.S256())
		keys = append(keys, key)
		signed[id] = true
		fmt.Println("Signing ...")
		fmt.Printf("User %d has signed successfully.\n\n", id)
	}

	partyIDs := make(tss.UnSortedPartyIDs, len(keys))
	for i, key := range keys {
		pMoniker := fmt.Sprintf("%d", i+1)
		partyIDs[i] = tss.NewPartyID(pMoniker, pMoniker, key.ShareID)
	}
	sortedPIDs := tss.SortPartyIDs(partyIDs)
	sort.Slice(keys, func(i, j int) bool { return keys[i].ShareID.Cmp(keys[j].ShareID) == -1 })

	return keys, sortedPIDs, nil
}

func LoadKeygenSet(qty int, optionalStart ...int) ([]keygen.LocalPartySaveData, tss.SortedPartyIDs, error) {
	keys := make([]keygen.LocalPartySaveData, 0, qty)
	start := 0
	if 0 < len(optionalStart) {
		start = optionalStart[0]
	}
	for i := start; i < qty; i++ {
		fixtureFilePath := makeTestFixtureFilePath(i)
		bz, err := ioutil.ReadFile(fixtureFilePath)
		if err != nil {
			return nil, nil, errors.Wrapf(err,
				"could not open the test fixture for party %d in the expected location: %s. run keygen tests first.",
				i, fixtureFilePath)
		}
		var key keygen.LocalPartySaveData
		if err = json.Unmarshal(bz, &key); err != nil {
			return nil, nil, errors.Wrapf(err,
				"could not unmarshal fixture data for party %d located at: %s",
				i, fixtureFilePath)
		}
		for _, kbxj := range key.BigXj {
			kbxj.SetCurve(tss.S256())
		}
		key.ECDSAPub.SetCurve(tss.S256())
		keys = append(keys, key)
	}
	partyIDs := make(tss.UnSortedPartyIDs, len(keys))
	for i, key := range keys {
		pMoniker := fmt.Sprintf("%d", i+start+1)
		partyIDs[i] = tss.NewPartyID(pMoniker, pMoniker, key.ShareID)
	}
	sortedPIDs := tss.SortPartyIDs(partyIDs)
	return keys, sortedPIDs, nil
}



func getPubkeyAddress(participants int) common.Address{
    keys, _, err := LoadKeygenSet(participants)
    if err != nil {
        log.Fatalf("Failed to load keygen fixtures: %v", err)
    }

    // Extract ECDSA Public key
    pkX, pkY := keys[0].ECDSAPub.X(), keys[0].ECDSAPub.Y()
    pubKey := ecdsa.PublicKey{
        Curve: tss.EC(),
        X:     pkX,
        Y:     pkY,
    }

	address := crypto.PubkeyToAddress(pubKey)

	// fmt.Printf("Signer address: %s\n", address.Hex())

	return address
}

func testDistributedSigning(threshold int, message string) (rHex, sHex, vStr string, err error) {
	hash := sha256.New()
	hash.Write([]byte(message))
	hashedMessage := hash.Sum(nil)

	messageToSign := new(big.Int).SetBytes(hashedMessage)

	keys, signPIDs, err := LoadKeygenTestFixturesSet(threshold + 1)
	if err != nil {
		return "", "", "", fmt.Errorf("should load keygen fixtures: %w", err)
	}

	p2pCtx := tss.NewPeerContext(signPIDs)
	parties := make([]*signing.LocalParty, 0, len(signPIDs))

	errCh := make(chan *tss.Error, len(signPIDs))
	outCh := make(chan tss.Message, len(signPIDs))
	endCh := make(chan tsscommon.SignatureData, len(signPIDs))
	endChPtr := make(chan *tsscommon.SignatureData, len(signPIDs))

	updater := test.SharedPartyUpdater

	for i := 0; i < len(signPIDs); i++ {
		params := tss.NewParameters(tss.S256(), p2pCtx, signPIDs[i], len(signPIDs), threshold)

		P := signing.NewLocalParty(messageToSign, params, keys[i], outCh, endCh).(*signing.LocalParty)
		parties = append(parties, P)
		go func(P *signing.LocalParty) {
			if err := P.Start(); err != nil {
				errCh <- err
			}
		}(P)
	}

	go func() {
		for sig := range endCh {
			endChPtr <- &sig
		}
	}()

	var ended int32
	for {
		select {
		case err := <-errCh:
			return "", "", "", fmt.Errorf("error: %w", err)

		case msg := <-outCh:
			dest := msg.GetTo()
			if dest == nil {
				for _, P := range parties {
					if P.PartyID().Index == msg.GetFrom().Index {
						continue
					}
					go updater(P, msg, errCh)
				}
			} else {
				if dest[0].Index == msg.GetFrom().Index {
					return "", "", "", fmt.Errorf("party %d tried to send a message to itself (%d)", dest[0].Index, msg.GetFrom().Index)
				}
				go updater(parties[dest[0].Index], msg, errCh)
			}

		case sig := <-endChPtr:
			atomic.AddInt32(&ended, 1)
			if atomic.LoadInt32(&ended) == int32(len(signPIDs)) {
				r := new(big.Int).SetBytes(sig.R)
				s := new(big.Int).SetBytes(sig.S)
				v := sig.SignatureRecovery[0] + 27

				rHex = fmt.Sprintf("0x%s", hex.EncodeToString(r.Bytes()))
				sHex = fmt.Sprintf("0x%s", hex.EncodeToString(s.Bytes()))
				vStr = fmt.Sprintf("%d", v)

				pkX, pkY := keys[0].ECDSAPub.X(), keys[0].ECDSAPub.Y()
				pk := ecdsa.PublicKey{
					Curve: tss.EC(),
					X:     pkX,
					Y:     pkY,
				}
				ok := ecdsa.Verify(&pk, messageToSign.Bytes(), r, s)
				if !ok {
					return "", "", "", fmt.Errorf("ecdsa verify must pass")
				}
				fmt.Print("ECDSA signing done.")
				return rHex, sHex, vStr, nil
			}
		}
	}
}

func handleSign(w http.ResponseWriter, r *http.Request) {
	message := r.URL.Query().Get("message")
	if message == "" {
		http.Error(w, "Message is required", http.StatusBadRequest)
		return
	}

	threshold := 1

	rHex, sHex, vStr, err := testDistributedSigning(threshold, message)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]string{
		"r": rHex,
		"s": sHex,
		"v": vStr,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func main() {
    fs := http.FileServer(http.Dir("../../frontend/build"))
    http.Handle("/", fs)

    http.HandleFunc("/sign", handleSign)

    handler := cors.Default().Handler(http.DefaultServeMux)

    fmt.Println("Starting server on :8080")
    log.Fatal(http.ListenAndServe(":8080", handler))
}



// func main() {
// 	_, err := rpc.DialContext(context.Background(), rpcURL)
// 	if err != nil {
// 		log.Fatalf("Failed to connect to the Ethereum client: %v", err)
// 	}

// 	participants := 3
// 	address := getPubkeyAddress(participants)
// 	fmt.Printf("Signer address: %s\n", address.Hex())


// 	fmt.Println("Starting signing process...")
// 	testDistributedSigning(1, address.String())
// }