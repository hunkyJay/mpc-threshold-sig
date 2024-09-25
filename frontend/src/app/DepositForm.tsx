// // src/app/DepositForm.tsx
// import React, { useState } from 'react';
// import { useThresholdSigContext } from '../contexts/ThresholdSigContext';

// const DepositForm: React.FC = () => {
//     const { state } = useThresholdSigContext();
//     const [amount, setAmount] = useState('');

//     const handleSubmit = async (event: React.FormEvent) => {
//         event.preventDefault();
//         if (state.web3 && state.account && state.contract) {
//             try {
//                 await state.web3.eth.sendTransaction({
//                     from: state.account,
//                     to: state.contract.options.address,
//                     value: state.web3.utils.toWei(amount, 'wei'),
//                 });
//                 alert('Deposit successful!');
//             } catch (error: any) {
//                 console.error(error);
//                 alert(`Deposit failed: ${error.message}`);
//             }
//         } else {
//             alert('Web3, account, or contract not loaded');
//         }
//     };

//     return (
//         <form onSubmit={handleSubmit}>
//             <label>
//                 Deposit Amount (in Wei):
//                 <input
//                     type="text"
//                     value={amount}
//                     onChange={(e) => setAmount(e.target.value)}
//                 />
//             </label>
//             <button type="submit">Deposit</button>
//         </form>
//     );
// };

// export default DepositForm;


import React, { useState } from "react";
import Web3 from "web3";
import BN from "bn.js";
import { Button, Form } from "semantic-ui-react";
import { useThresholdSigContext } from "../contexts/ThresholdSigContext";
import useAsync from "../components/useAsync";

interface DepositParams {
    web3: Web3;
    account: string;
    value: BN;
}

const DepositForm: React.FC = () => {
    const { state } = useThresholdSigContext();

    const [input, setInput] = useState("");
    const { pending, call } = useAsync<DepositParams, void>(
        async ({ web3, account, value }) => {
            try {
                await web3.eth.sendTransaction({
                    from: account,
                    to: state.contract.options.address,
                    value: value.toString()
                });
                // alert('Deposit successful!');
            } catch (error: any) {
                console.error(error);
                alert(`Deposit failed: ${error.message}`);
            }
        }
    );

    function onChange(e: React.ChangeEvent<HTMLInputElement>) {
        setInput(e.target.value);
    }

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (pending) {
            return;
        }

        if (!state.web3) {
            alert("No web3");
            return;
        }

        const value = new BN(input);
        const zero = new BN(0);

        if (value.gt(zero)) {
            const { error } = await call({
                web3: state.web3,
                account: state.account,
                value,
            });

            if (error) {
                alert(`Error: ${error.message}`);
            } else {
                setInput("");
            }
        }
    }

    return (
        <Form onSubmit={onSubmit}>
            <Form.Field>
                <Form.Input
                    icon={<img src="/ethereumblue.svg" alt="Ethereum Icon" className="input-icon" />}
                    placeholder="Amount to deposit wei"
                    type="number"
                    min={0}
                    value={input}
                    onChange={onChange}
                />
            </Form.Field>
            <Button disabled={pending} loading={pending}>
                Deposit
            </Button>
        </Form>
    );
};

export default DepositForm;
