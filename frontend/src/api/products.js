// frontend/src/api/products.js
// 상품 + 5-H 에서 만든 리뷰/QnA/통계 API
//
// 사용 예시:
//   import { productsApi } from '../api/products';
//   const { data } = await productsApi.list({ page: 0, size: 24, productType: 'KEYBOARD' });
//   const { data: product } = await productsApi.detail(11);

import apiClient from './client';

export const productsApi = {
  // GET /api/products?page=&size=&productType=&keyword=
  list: (params = {}) => apiClient.get('/products', { params }),

  // GET /api/products/:id
  detail: (id) => apiClient.get(`/products/${id}`),

  // GET /api/products/:id/reviews?page=&size=&sort=latest|rating|helpful
  reviews: (id, params = {}) =>
    apiClient.get(`/products/${id}/reviews`, { params }),

  // GET /api/products/:id/reviews/stats - 5-H B5
  reviewStats: (id) => apiClient.get(`/products/${id}/reviews/stats`),

  // GET /api/products/:id/qna?page=&size=
  qna: (id, params = {}) =>
    apiClient.get(`/products/${id}/qna`, { params }),
};

export default productsApi;
