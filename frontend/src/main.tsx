import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CartProvider } from "./cart";
import { Cart, Checkout, Done, Home, Layout, List, ProductPage } from "./Store";
import { AdminShell, Categories, Login, Orders, Products } from "./Admin";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CartProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="c/:slug" element={<List />} />
            <Route path="search" element={<List />} />
            <Route path="p/:slug" element={<ProductPage />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="done/:num" element={<Done />} />
          </Route>
          <Route path="admin/login" element={<Login />} />
          <Route path="admin" element={<AdminShell />}>
            <Route index element={<Orders />} />
            <Route path="products" element={<Products />} />
            <Route path="categories" element={<Categories />} />
          </Route>
        </Routes>
      </CartProvider>
    </BrowserRouter>
  </React.StrictMode>
);
