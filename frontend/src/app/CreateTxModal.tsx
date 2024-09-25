import React, { useState } from "react";
import { Button, Modal, Form, Message } from "semantic-ui-react";
import useAsync from "../components/useAsync";
import { useThresholdSigContext } from "../contexts/ThresholdSigContext";
import CryptoJS from 'crypto-js';

interface Props {
    open: boolean;
    onClose: (event?: any) => void;
}

interface SubmitTxParams {
    to: string;
    value: string;
}

const CreateTxModal: React.FC<Props> = ({ open, onClose }) => {
    const {
        state: { contract, account, web3, transactions },
        dispatch,
    } = useThresholdSigContext();

    const { pending, error, call } = useAsync<SubmitTxParams, any>(
        async (params) => {
            if (!web3 || !contract) {
                throw new Error("No web3 or contract");
            }

            const message = `Transfer ${params.value} Wei to ${params.to}`;
            const messageHash = "0x" + CryptoJS.SHA256(message).toString(CryptoJS.enc.Hex);

            const response = await fetch(`/sign?message=${encodeURIComponent(message)}`);
            const data = await response.json();

            await contract.methods.transfer(
                params.to,
                params.value,
                messageHash,
                data.v,
                data.r,
                data.s
            ).send({ from: account });

            // Update the state with the new transaction
            const newTransaction = {
                txIndex: transactions.length + 1,
                to: params.to,
                value: params.value,
                executed: true,
            };

            dispatch({ type: 'ADD_TRANSACTION', transaction: newTransaction });
        }
    );

    const [inputs, setInputs] = useState({
        to: "",
        value: "",
    });

    function onChange(name: string, e: React.ChangeEvent<HTMLInputElement>) {
        setInputs({
            ...inputs,
            [name]: e.target.value,
        });
    }

    async function onSubmit() {
        if (pending) {
            return;
        }

        const params = {
            ...inputs,
            value: inputs.value.toString(),
        };

        const { error } = await call(params);

        if (!error) {
            onClose();
        }
    }

    return (
        <Modal open={open} onClose={onClose}>
            <Modal.Header>Create Transaction</Modal.Header>
            <Modal.Content>
                {error && <Message error>{error.message}</Message>}
                <Form onSubmit={onSubmit}>
                    <Form.Field>
                        <label>To</label>
                        <Form.Input
                            type="text"
                            value={inputs.to}
                            onChange={(e) => onChange("to", e)}
                            placeholder="The account address"
                        />
                    </Form.Field>
                    <Form.Field>
                        <label>Value</label>
                        <Form.Input
                            type="number"
                            min={1}
                            value={inputs.value}
                            onChange={(e) => onChange("value", e)}
                            placeholder="Wei to transfer"
                        />
                    </Form.Field>
                </Form>
            </Modal.Content>
            <Modal.Actions>
                <Button className="Action-button" onClick={onClose} disabled={pending}>
                    Cancel
                </Button>
                <Button className="Action-button"
                    color="green"
                    onClick={onSubmit}
                    disabled={pending}
                    loading={pending}
                >
                    Create
                </Button>
            </Modal.Actions>
        </Modal>
    );
};

export default CreateTxModal;
