import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProductList from './pages/ProductList'
import ProductDetail from './pages/ProductDetail'
import KeyboardBuilder from './KeyboardBuilder'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/products" replace />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/builder/:id" element={<KeyboardBuilder />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
