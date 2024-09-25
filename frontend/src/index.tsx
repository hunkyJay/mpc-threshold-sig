// import React from 'react';
// import ReactDOM from 'react-dom';
// import { ThresholdSigProvider } from './contexts/ThresholdSigContext';
// import App from './app/App';
// import './index.css';

// ReactDOM.render(
//   <React.StrictMode>
//     <ThresholdSigProvider>
//       <App />
//     </ThresholdSigProvider>
//   </React.StrictMode>,
//   document.getElementById('root')
// );


import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './app/App';
import ThresholdSigDashboard from './app/ThresholdSigDashboard';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  Provider as Web3Provider,
  Updater as Web3Updater,
} from "./contexts/Web3";
import {
  ThresholdSigProvider,
} from "./contexts/ThresholdSigContext";
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Web3Provider>
        <ThresholdSigProvider>
          <Web3Updater />
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/dashboard" element={<ThresholdSigDashboard />} />
          </Routes>
        </ThresholdSigProvider>
      </Web3Provider>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
