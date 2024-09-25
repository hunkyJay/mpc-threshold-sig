const ThresholdSignature = artifacts.require("ThresholdSig");
const crypto = require('crypto');

contract("ThresholdSig", accounts => {
    const [deployer, signer] = accounts;

    it("should verify the signature correctly", async () => {
        const instance = await ThresholdSignature.deployed();

        // Message to be signed
        const message = "Hello, Ethereum!";
        // const messageHash = web3.utils.sha3(message);
        const messageHash = "0x" + crypto.createHash('sha256').update(message).digest('hex');

        // Signature components
        const r = "0x5561c2649e7765ef523a3e3adc13763dad71d72a17a663f4cfee61dae6bfc853";
        const s = "0x254d9644e7810d1dd297981785f87abf317acbb08470a67cd557607190a8bad6"; 
        const v = 28;

        // Verify the signature
        const isValid = await instance.verifySignature(messageHash, v, r, s);
        assert.isTrue(isValid, "The signature should be valid");
    });
});
