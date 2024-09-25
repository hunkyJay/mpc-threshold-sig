import Web3 from 'web3';

export async function unlockAccount() {
    // @ts-ignore
    const {ethereum} = window;

    if(!ethereum) {
        throw new Error(`Web3 not found`);
    }

    const web3 = new Web3(ethereum);
    // await ethereum.enable();

    try {
        await ethereum.request({ method: 'eth_requestAccounts' });
    } catch (error: any) {
        throw new Error(`Failed to unlock account: ${error.message}`);
    }

    const accounts = await web3.eth.getAccounts();

    return { web3, account: accounts[0] || "" };
}

export function subscribeToAccount(
    web3: Web3,
    callback: (error: Error | null, account: string | null) => any
) {
    const id = setInterval(async () => {
        try {
            const accounts = await web3.eth.getAccounts();
            callback(null, accounts[0] || "");
        } catch (error: any) {
            callback(error, null);
        }
    }, 1000);

    return () => {
        clearInterval(id)
    };
}

export function subscribeToNetId(
    web3: Web3,
    callback: (error: Error | null, netId: number | null) => any
) {
    const id = setInterval(async () => {
        try {
            const netId = await web3.eth.net.getId();
            callback(null, Number(netId));
        } catch (error: any) {
            callback(error, null);
        }
    }, 1000);

    return () => {
        clearInterval(id);
    };
}

