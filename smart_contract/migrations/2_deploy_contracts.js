const ThresholdSignature = artifacts.require("ThresholdSig");

module.exports = function (deployer) {
    const signer = "0xE600B1a4b174E7Eb5b3a08EDBD2C7fc95634D149";
    deployer.deploy(ThresholdSignature, signer);
};