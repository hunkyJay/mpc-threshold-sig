import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import Web3 from 'web3';

interface Transaction {
    txIndex: number;
    to: string;
    value: string;
    executed: boolean;
}

interface State {
    web3: Web3 | null;
    account: string;
    contract: any;
    transactions: Transaction[];
    eventsListenerAdded: boolean;
    balance: string;
}

const initialState: State = {
    web3: null,
    account: '',
    contract: null,
    transactions: [],
    eventsListenerAdded: false,
    balance: '0'
};

const ThresholdSigContext = createContext<{
    state: State;
    dispatch: React.Dispatch<any>;
}>({
    state: initialState,
    dispatch: () => null,
});
const reducer = (state: State, action: any) => {
    switch (action.type) {
        case 'SET_WEB3':
            return { ...state, web3: action.web3 };
        case 'SET_ACCOUNT':
            return { ...state, account: action.account };
        case 'SET_CONTRACT':
            return { ...state, contract: action.contract };
        case 'ADD_TRANSACTION':
            // Ensure txIndex is unique
            if (!state.transactions.some(tx => tx.txIndex === action.transaction.txIndex)) {
                return { ...state, transactions: [...state.transactions, action.transaction] };
            }
            return state;
        case 'SET_TRANSACTIONS':
            return { ...state, transactions: action.transactions };
        case 'SET_EVENTS_LISTENER_ADDED':
            return { ...state, eventsListenerAdded: action.eventsListenerAdded };
        case 'SET_BALANCE':
            return { ...state, balance: action.balance };
        default:
            return state;
    }
};

interface ProviderProps {
    children: ReactNode;
}

declare global {
    interface Window {
        ethereum: any;
    }
}

export const ThresholdSigProvider: React.FC<ProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, initialState);

    useEffect(() => {
        const loadWeb3 = async () => {
            if (window.ethereum) {
                const web3 = new Web3(window.ethereum);
                dispatch({ type: 'SET_WEB3', web3 });

                try {
                    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                    dispatch({ type: 'SET_ACCOUNT', account: accounts[0] });

                    const responseContractInfo = await fetch('/contracts/ThresholdSig.json');
                    const contractInfo = await responseContractInfo.json();
                    const networkId = await web3.eth.net.getId();
                    const deployedNetwork = contractInfo.networks[networkId];
                    if (deployedNetwork) {
                        const contract = new web3.eth.Contract(contractInfo.abi, deployedNetwork.address);
                        dispatch({ type: 'SET_CONTRACT', contract });

                        const balance = await web3.eth.getBalance(contract.options.address);
                        dispatch({ type: 'SET_BALANCE', balance });

                        const pastEvents = await contract.getPastEvents('Transfer', {
                            fromBlock: 0,
                            toBlock: 'latest'
                        });

                        const transactions = pastEvents.map((event, index) => ({
                            txIndex: index,
                            to: event.returnValues.to,
                            value: event.returnValues.amount,
                            executed: true
                        }));

                        dispatch({ type: 'SET_TRANSACTIONS', transactions });

                        // Ensure events listener is only added once
                        if (!state.eventsListenerAdded) {
                            contract.events.Transfer({}, (error: any, event: { returnValues: { to: any; amount: any; }; }) => {
                                if (error) {
                                    console.error('Error on event', error);
                                    return;
                                }

                                const newTransaction = {
                                    txIndex: state.transactions.length + 1,
                                    to: event.returnValues.to,
                                    value: event.returnValues.amount,
                                    executed: true
                                };

                                console.log('New transaction event:', newTransaction);

                                // Check if the transaction already exists in the state
                                const exists = state.transactions.some((tx: { to: any; value: any; executed: any; }) =>
                                    tx.to === event.returnValues.to &&
                                    tx.value === event.returnValues.amount &&
                                    tx.executed
                                );

                                if (!exists) {
                                    dispatch({ type: 'ADD_TRANSACTION', transaction: newTransaction });
                                }
                            });



                            contract.events.Deposit({}, async (error: any) => {
                                if (error) {
                                    console.error('Error on deposit event', error);
                                    return;
                                }
                                const newBalance = await web3.eth.getBalance(contract.options.address);
                                dispatch({ type: 'SET_BALANCE', balance: newBalance });
                            });

                            dispatch({ type: 'SET_EVENTS_LISTENER_ADDED', eventsListenerAdded: true });
                        }
                    } else {
                        console.error('Contract not deployed on this network');
                    }
                } catch (error) {
                    console.error("User denied account access or other error", error);
                }
            } else {
                console.error("MetaMask not detected");
            }
        };

        loadWeb3();
    }, [state.eventsListenerAdded, dispatch]);

    return (
        <ThresholdSigContext.Provider value={{ state, dispatch }}>
            {children}
        </ThresholdSigContext.Provider>
    );
};

export const useThresholdSigContext = () => useContext(ThresholdSigContext);
