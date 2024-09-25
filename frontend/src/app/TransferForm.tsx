// src/app/TransferForm.tsx
import React, { useState } from 'react';
import { useThresholdSigContext } from '../contexts/ThresholdSigContext';
import Web3 from 'web3';
import CryptoJS from 'crypto-js';

const TransferForm: React.FC = () => {
    const { state } = useThresholdSigContext();
    const [to, setTo] = useState('');
    const [amount, setAmount] = useState('');

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const message = `Transfer ${amount} Wei to ${to}`;
        const messageHash = "0x" + CryptoJS.SHA256(message).toString(CryptoJS.enc.Hex);


        const response = await fetch(`/sign?message=${encodeURIComponent(message)}`);
        const data = await response.json();

        if (state.contract && messageHash) {
            try {
                await state.contract.methods.transfer(
                    to,
                    amount,
                    messageHash,
                    data.v,
                    data.r,
                    data.s
                ).send({ from: state.account });
                alert('Transfer successful!');
            } catch (error: any) {
                console.error(error);
                alert(`Transfer failed: ${error.message}`);
            }
        } else {
            alert('Web3, account, or contract not loaded');
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <label>
                To Address:
                <input
                    type="text"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                />
            </label>
            <label>
                Amount (in Wei):
                <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                />
            </label>
            <button type="submit">Transfer</button>
        </form>
    );
};

export default TransferForm;
