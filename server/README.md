# Server

Node.js + TypeScript modular monolith API.

Domain services own business rules and transactional posting. Route handlers validate inputs, authenticate the actor, authorize the operation and call domain services. Database writes affecting money or stock must use explicit transactions.
