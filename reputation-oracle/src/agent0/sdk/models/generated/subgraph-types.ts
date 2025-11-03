/**
 * Stub types for subgraph-generated types
 * In a full implementation, these would be generated from GraphQL schema
 */

export interface Agent {
  id?: string;
  chainId?: string | number;
  agentId?: string | number;
  owner?: string;
  operators?: string[];
  agentURI?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export interface AgentRegistrationFile {
  id?: string;
  agentId?: string;
  name?: string;
  description?: string;
  image?: string;
  active?: boolean;
  x402support?: boolean;
  supportedTrusts?: string[];
  mcpEndpoint?: string;
  mcpVersion?: string;
  a2aEndpoint?: string;
  a2aVersion?: string;
  ens?: string;
  did?: string;
  agentWallet?: string;
  agentWalletChainId?: number;
  mcpTools?: string[];
  mcpPrompts?: string[];
  mcpResources?: string[];
  a2aSkills?: string[];
  createdAt?: string | number;
}

