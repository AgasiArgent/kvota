#!/bin/bash
# Railway GraphQL API helper script
# Usage: ./railway-api.sh <query-name>

TOKEN="***REMOVED***"
API_URL="https://backboard.railway.app/graphql/v2"
PROJECT_ID="8665b186-c453-47e4-a5f7-20211de50414"
SERVICE_ID="943f2c47-f03d-4558-a6a1-752d74d81fe8"

query_projects() {
  curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"query":"query { projects { edges { node { id name services { edges { node { id name } } } } } } }"}' \
    "$API_URL"
}

query_deployments() {
  curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"query { service(id: \\\"$SERVICE_ID\\\") { deployments(first: 5) { edges { node { id status staticUrl createdAt } } } } }\"}" \
    "$API_URL"
}

query_latest_deployment() {
  curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"query { service(id: \\\"$SERVICE_ID\\\") { deployments(first: 1) { edges { node { id status staticUrl createdAt } } } } }\"}" \
    "$API_URL"
}

case "${1:-latest}" in
  projects)
    query_projects
    ;;
  deployments)
    query_deployments
    ;;
  latest)
    query_latest_deployment
    ;;
  *)
    echo "Usage: $0 {projects|deployments|latest}"
    exit 1
    ;;
esac
