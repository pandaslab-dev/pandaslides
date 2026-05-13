import { Navigate, Route, Routes } from "react-router-dom";
import { OperatorPage } from "./pages/Operator";
import { DisplayPage } from "./pages/Display";
import { StagePage } from "./pages/Stage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/operator" replace />} />
      <Route path="/operator" element={<OperatorPage />} />
      <Route path="/display" element={<DisplayPage />} />
      <Route path="/stage" element={<StagePage />} />
    </Routes>
  );
}
