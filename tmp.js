var express = require('express');
var config = require('../routes/config.json');
var request = require("request");
var Web3 = require('web3');
const httpEndPoint = config.connectionURL;
var web3 = new Web3(new Web3.providers.HttpProvider(httpEndPoint));
const contractAddress = config.contractAddress;
const abi = require('./abi.json');
const walletAddressValidator = require("wallet-address-validator");

module.exports = {

    createAccount: async (req, res) => {
        let hex = randomHex();
        let account = await web3.eth.accounts.create(hex);
        res.status(200).send({ status: true, address: account });
    },

    getTetherBalance: async (req, res) => {
        try {
            var valid = await walletAddressValidator.validate(req.query.address, 'ETH');
            var tokenContract = await new web3.eth.Contract(abi, contractAddress);
            if (valid) {
                var balance = await tokenContract.methods.balanceOf(req.query.address).call({
                    from: contractAddress
                });
                res.status(200).send({ status: true, balance: (balance / 1000000) });
            }
            else{
                res.send({status : false , error : "Invalid Address"})
            }
        } catch (err) {
            console.log(err);
            res.send({status : false , error : "Invalid Address"})
        }
    },

    getTransactionByhash: async (req, res) => {
        let transactionData = await web3.eth.getTransaction(req.query.hash);
        //   console.log(transactionData)
        res.status(200).send({ status: true, data: transactionData });
    },

    transferTether: async (req, res) => {
        console.log("This is tranfer From address",req.body.value)
        var tokenContract = await new web3.eth.Contract(abi, contractAddress);
        var balance = await tokenContract.methods.balanceOf(req.body.fromAddress).call({
            from: contractAddress
        });
        if (balance / 1000000 >= parseFloat(req.body.value)) {
            //var tokenContract = new web3.eth.Contract(abi, contractAddress);
            try {
                var estimatedGas = await tokenContract.methods.transfer(req.body.toAddress, parseFloat(req.body.value) * 1000000).estimateGas({
                    from: req.body.fromAddress,
                    gas: 100000
                });
            } catch (error) {
                res.send({ status: false, error: "not sufficient ETH balance" })
                console.log('1', error);
            }

            estimatedGas = estimatedGas + 60000;
            try {

                var data = await tokenContract.methods.transfer(req.body.toAddress, parseInt(parseFloat(req.body.value) * 1000000)).encodeABI();
            } catch (error) {
                res.send({ status: false, error: "not sufficient ETH balance" })
                console.log('2', error);
            }

            let gasPrice = await web3.eth.getGasPrice();


            var signStatus = await web3.eth.accounts.signTransaction({
                "from": req.body.fromAddress,
                "to": contractAddress,
                "gas": estimatedGas,
                "data": data,
                "gasPrice": gasPrice
            }, req.body.privateKey);

            let hash;

            try {
                var transactionData = await web3.eth.sendSignedTransaction(signStatus.rawTransaction, function (error, transactionHash) {
                    if (error) {
                        console.log('3', error);
                        throw (error);
                    } else {
                        hash = transactionHash;
                        console.log(hash);
                    }
                    res.status(200).send({ status: true, hash: hash });
                });

            } catch (error) {
                console.log('4', error);
                res.send({ status: false, error: "not sufficient ETH balance" })
            }
        }
        else {
            res.send({ status: false, error: "not sufficient ETH balance" })
        }
    },


    getEstimatedGasFees: async (req, res) => {
        let gasPrice = await web3.eth.getGasPrice();
        let estimate = await web3.eth.estimateGas({
            from: '0x36928500bc1dcd7af6a2b4008875cc336b927d57',
            to: '0x36928500bc1dcd7af6a2b4008875cc336b927d57',
            value: '1',
            gasPrice: gasPrice
        });
        console.log("here1", gasPrice, estimate)
        let fee = await (toBN(estimate) * toBN(gasPrice));
        res.status(200).send({ status: true, estimatedGas: fee });

    }

}


//Helper functions 

function randomHex() {
    let hex = web3.utils.randomHex(32);
    return hex;
}

function toBN(number) {
    let bn = web3.utils.toBN(number);
    return bn;
}

function toWei(balance) {
    let wei = web3.utils.toWei(balance);
    return wei;
}
