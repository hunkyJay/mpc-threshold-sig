import React, { useState, useEffect } from "react";
import { useThresholdSigContext } from "../contexts/ThresholdSigContext";
import { Button } from "semantic-ui-react";
import DepositForm from "./DepositForm";
import CreateTxModal from "./CreateTxModal";
import { useNavigate } from "react-router-dom";
import { useWeb3Context } from '../contexts/Web3';
import Network from "./Network";
import './ThresholdSigDashboard.css';
import HistoryModal from "./HistoryModal";
import useDocumentTitle from '../components/useDocumentTitle';

function ThresholdSigDashboard() {
    useDocumentTitle('Dashboard - ThresholdSig');
    const { state } = useThresholdSigContext();
    const { state: web3State } = useWeb3Context();
    const { netId } = web3State;
    const { account } = web3State;
    const navigate = useNavigate();
    const [open, openModal] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);

    const openHistoryModal = () => setHistoryModalOpen(true);
    const closeHistoryModal = () => setHistoryModalOpen(false);

    useEffect(() => {
        const handleAccountChange = () => {
            if (web3State.account) {
                console.log("Account connected:", web3State.account);
            } else {
                navigate("/");
            }
        };

        handleAccountChange();

    }, [web3State.account, navigate]);

    return (
        <div className="ThresholdSigDashboard">
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <img src="/network.svg" alt="Ethernet Icon" className="network-icon" />
                <span>{netId !== 0 && <Network netId={netId} />}</span>
            </div>
            <header className="Wallet-header">
                <div>Threshold Signature Wallet: {state.contract?.options.address}</div>
            </header>
            <div className="content-container">
                <h3>Balance: {state.balance} wei</h3> { }
                <DepositForm />
                <h3>Transactions ({state.transactions.length})</h3>
                <div>
                    <Button className="Button-margin" onClick={() => openModal(true)}>
                        Create Transaction
                    </Button>
                    <Button onClick={openHistoryModal}>
                        View History
                    </Button>
                </div>
                {open && <CreateTxModal open={open} onClose={() => openModal(false)} />}
            </div>

            <HistoryModal
                transactions={state.transactions.filter(tx => tx.executed)}
                open={historyModalOpen}
                onClose={closeHistoryModal}
            />
        </div>
    );
}

export default ThresholdSigDashboard;
