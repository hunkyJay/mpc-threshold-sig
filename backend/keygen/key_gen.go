package main

import (
	// "flag"
	// "crypto/ecdsa"
	"encoding/json"
	"fmt"
	"io/ioutil"
	// "crypto/sha256"
	// "math/big"
	// "math/rand"
	"os"
	"path/filepath"
	"runtime"
	// "sort"
	"sync/atomic"

	"github.com/lastingasset/tss-lib/common"
	"github.com/lastingasset/tss-lib/ecdsa/keygen"
	// "github.com/lastingasset/tss-lib/ecdsa/signing"
	"github.com/lastingasset/tss-lib/test"
	"github.com/lastingasset/tss-lib/tss"
	"github.com/pkg/errors"
	// "github.com/stretchr/testify/assert"
)

const (
	testFixtureDirFormat  = "%s/_fixtures"
	testFixtureFileFormat = "keygen_data_%d.json"
)

func makeTestFixtureFilePath(partyIndex int) string {
	_, callerFileName, _, _ := runtime.Caller(0)
	srcDirName := filepath.Dir(callerFileName)
	fixtureDirName := fmt.Sprintf(testFixtureDirFormat, srcDirName)
	return fmt.Sprintf("%s/"+testFixtureFileFormat, fixtureDirName, partyIndex)
}

func tryWriteTestFixtureFile(index int, data keygen.LocalPartySaveData) {
    fixtureFileName := makeTestFixtureFilePath(index)

	// Check the fixture file exists
    fixtureDir := filepath.Dir(fixtureFileName)
    if err := os.MkdirAll(fixtureDir, os.ModePerm); err != nil {
        fmt.Printf("Error creating directory %s: %s\n", fixtureDir, err)
        return
    }

    // Open and write data in
    fi, err := os.Stat(fixtureFileName)
    if !(err == nil && fi != nil && !fi.IsDir()) {
        fd, err := os.OpenFile(fixtureFileName, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
        if err != nil {
            fmt.Printf("Unable to open fixture file %s for writing: %s\n", fixtureFileName, err)
            return
        }
        defer fd.Close()

        bz, err := json.Marshal(&data)
        if err != nil {
            fmt.Printf("Unable to marshal save data for fixture file %s: %s\n", fixtureFileName, err)
            return
        }

        _, err = fd.Write(bz)
        if err != nil {
            fmt.Printf("Unable to write to fixture file %s: %s\n", fixtureFileName, err)
            return
        }

        fmt.Printf("Saved a test fixture file for party %d: %s\n", index, fixtureFileName)
    } else {
        fmt.Printf("Fixture file already exists for party %d; not re-creating: %s\n", index, fixtureFileName)
    }
}

func LoadKeygenTestFixtures(qty int, optionalStart ...int) ([]keygen.LocalPartySaveData, tss.SortedPartyIDs, error) {
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



func distibutedKeyGeneration(participants, threshold int) {

	fixtures, pIDs, err := LoadKeygenTestFixtures(participants)
	if err != nil {
		common.Logger.Info("No test fixtures were found, so the safe primes will be generated from scratch. This may take a while...")
		pIDs = tss.GenerateTestPartyIDs(participants)
	}

	p2pCtx := tss.NewPeerContext(pIDs)
	parties := make([]*keygen.LocalParty, 0, len(pIDs))

	errCh := make(chan *tss.Error, len(pIDs))
	outCh := make(chan tss.Message, len(pIDs))
	endCh := make(chan keygen.LocalPartySaveData, len(pIDs))

	updater := test.SharedPartyUpdater

	startGR := runtime.NumGoroutine()

	// init the parties
	for i := 0; i < len(pIDs); i++ {
		var P *keygen.LocalParty
		params := tss.NewParameters(tss.S256(), p2pCtx, pIDs[i], len(pIDs), threshold)
		if i < len(fixtures) {
			P = keygen.NewLocalParty(params, outCh, endCh, fixtures[i].LocalPreParams).(*keygen.LocalParty)
		} else {
			P = keygen.NewLocalParty(params, outCh, endCh).(*keygen.LocalParty)
		}
		parties = append(parties, P)
		go func(P *keygen.LocalParty) {
			if err := P.Start(); err != nil {
				errCh <- err
			}
		}(P)
	}

	// PHASE: keygen
	var ended int32
keygen:
	for {
		fmt.Printf("ACTIVE GOROUTINES: %d\n", runtime.NumGoroutine())
		select {
		case err := <-errCh:
			common.Logger.Errorf("Error: %s", err)
			break keygen

		case msg := <-outCh:
			dest := msg.GetTo()
			if dest == nil { // broadcast!
				for _, P := range parties {
					if P.PartyID().Index == msg.GetFrom().Index {
						continue
					}
					go updater(P, msg, errCh)
				}
			} else { // point-to-point!
				if dest[0].Index == msg.GetFrom().Index {
					fmt.Errorf("party %d tried to send a message to itself (%d)", dest[0].Index, msg.GetFrom().Index)
					return
				}
				go updater(parties[dest[0].Index], msg, errCh)
			}

		case save := <-endCh:
			// SAVE a test fixture file for this P (if it doesn't already exist)
			// .. here comes a workaround to recover this party's index (it was removed from save data)
			index, _ := save.OriginalIndex()
			tryWriteTestFixtureFile(index, save)

			atomic.AddInt32(&ended, 1)
			if atomic.LoadInt32(&ended) == int32(len(pIDs)) {
				fmt.Printf("Done. Received save data from %d participants ", ended)
				fmt.Printf("Start goroutines: %d, End goroutines: %d", startGR, runtime.NumGoroutine())

				break keygen
			}
		}
	}

}


func main() {

    // Variables for participants and threshold, can also be set via flags if variable
    var testParticipants, testThreshold int

    // Asking for user input if needed
    fmt.Print("Enter number of participants: ")
    fmt.Scan(&testParticipants)
    fmt.Print("Enter threshold (must be less than or equal to participants): ")
    fmt.Scan(&testThreshold)

    if testThreshold > testParticipants {
        fmt.Println("Threshold must be less than or equal to the number of participants.")
        os.Exit(1)
    }

	fmt.Println("Starting key generation...")
    distibutedKeyGeneration(testParticipants, testThreshold)
}