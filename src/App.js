import { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { InjectedConnector } from 'wagmi/connectors/injected'
import ApiWrapper from '@polkadex/api-wrapper'
import { splitSignature, } from "ethers/lib/utils";
import { u8aToHex } from "@polkadot/util";
import { cryptoWaitReady } from '@polkadot/util-crypto';
import Utils from '@polkadex/utils'
import Web3 from 'web3';

const elliptic = require('elliptic');
const ec = new elliptic.ec('secp256k1');

const privateKey = "0f5315135dffad49c9422d8368865c13c5dbdeed31405aad96214c6b71f11fcc"
const keyPair = ec.keyFromPrivate(privateKey)

function App() {
    const { address, isConnected } = useAccount()
    const [apiInstance, setApiInstance] = useState();
    const { connect } = useConnect({
        connector: new InjectedConnector(),
    })
    const { disconnect } = useDisconnect()


    useEffect(() => {
        const instance = new ApiWrapper({ isMain: true })
        setApiInstance(instance)
    }, [])

    const handleSendTransfer = async () => {
        const api = apiInstance.Api()
        await api.isReady

        if (window.ethereum) {
            const msg = "Some data"
            const web3 = new Web3(Web3.givenProvider)
            let accounts = await web3.eth.getAccounts();

            let prefix = "\x19Ethereum Signed Message:\n" + msg.length
            let msgHash = web3.utils.sha3(prefix + msg)

            let sig1 = await web3.eth.sign(msgHash, accounts[0]);
            console.log("initial signature", sig1)
            const sigObject = splitSignature(sig1)
            console.log("sig Object", sigObject)
            //const pureSig = fromRpcSig(sig1);


            const publicKey = Utils.recoverEcdsaPublicKey(msgHash, sig1)

            await cryptoWaitReady();

            const substrateAddress = Utils.getSubstrateAddressFromEcdsa(publicKey)

            const transaction = api.tx.balances.transfer('5GNJqTPyNqANBkUVMN1LPPrxXnFouWXoe2wNSmmEoLctxiZY', 12345)
            // TEMP
            console.log({ substrateAddress })
            const nonce = await apiInstance.getAccountNonce(substrateAddress)
            console.log({ nonce })
            const signingPayload = await api.createType('SignerPayload', {
                method: transaction,
                nonce: nonce,
                genesisHash: api.genesisHash,
                blockHash: api.genesisHash,
                runtimeVersion: api.runtimeVersion,
                version: api.extrinsicVersion
            })
            console.log({signingPayload})
            // END TEMP

            const extrinsicPayload = await apiInstance.createExtrinsicPayload(transaction, substrateAddress)
            console.log({ extrinsicPayload })

            const payloadHash = apiInstance.getHashedExtrinsicPayload(extrinsicPayload, 'ethereum')
            console.log({ payloadHash })

            let signatureEcdsa = await web3.eth.sign(u8aToHex(payloadHash), accounts[0]);

            const rtx = apiInstance.getTransactionSender(transaction, address, signatureEcdsa, signingPayload);
            console.log(rtx)
            const callback = function (data) {
                console.log(data)
            }
            rtx.send(callback)
        }
    }


    if (!isConnected) {
        return (
            <div className="App">
                <h1>Connect to wallet</h1>
                <button onClick={() => connect()}>Connect</button>
            </div>
        )
    }

    return (
        <div className="App">
            <div>
                Connected to {address}
                <button onClick={() => disconnect()}>Disconnect</button>
            </div>
            <div>
                Send transfer
                <button onClick={handleSendTransfer}>Send transfer</button>
            </div>
        </div>
    );
}

export default App;
