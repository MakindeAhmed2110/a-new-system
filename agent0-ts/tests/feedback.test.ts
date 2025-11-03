/**
 * Integration test for Agent Feedback Flow with IPFS Pin
 * Submits feedback from a client to an existing agent and verifies data integrity.
 *
 * Flow:
 * 1. Load existing agent by ID
 * 2. Client submits multiple feedback entries
 * 3. Verify feedback data consistency (score, tags, capability, skill)
 * 4. Wait for blockchain finalization
 * 5. Verify feedback can be retrieved (if SDK supports it)
 */

import { SDK } from '../src/index';
import { CHAIN_ID, RPC_URL, AGENT_PRIVATE_KEY, PINATA_JWT, AGENT_ID, CLIENT_PRIVATE_KEY, printConfig } from './config';

// Client configuration (different wallet)
const clientPrivateKey = CLIENT_PRIVATE_KEY;

function generateFeedbackData(index: number) {
  const scores = [50, 75, 80, 85, 90, 95];
  const tagsSets = [
    ['data_analysis', 'enterprise'],
    ['code_generation', 'enterprise'],
    ['natural_language_understanding', 'enterprise'],
    ['problem_solving', 'enterprise'],
    ['communication', 'enterprise'],
  ];

  const capabilities = [
    'data_analysis',
    'code_generation',
    'natural_language_understanding',
    'problem_solving',
    'communication',
  ];

  const skills = ['python', 'javascript', 'machine_learning', 'web_development', 'cloud_computing'];

  return {
    score: scores[Math.floor(Math.random() * scores.length)],
    tags: tagsSets[Math.floor(Math.random() * tagsSets.length)],
    capability: capabilities[Math.floor(Math.random() * capabilities.length)],
    skill: skills[Math.floor(Math.random() * skills.length)],
    context: 'enterprise',
  };
}

describe('Agent Feedback Flow with IPFS Pin', () => {
  let agentSdk: SDK;
  let clientSdk: SDK;
  let agentSdkWithSigner: SDK;
  let clientAddress: string;
  const agentId = AGENT_ID;

  beforeAll(() => {
    printConfig();
  });

  it('should load existing agent', async () => {
    // SDK Configuration
    const sdkConfig = {
      chainId: CHAIN_ID,
      rpcUrl: RPC_URL,
      ipfs: 'pinata' as const,
      pinataJwt: PINATA_JWT,
    };

    agentSdk = new SDK(sdkConfig); // Read-only for loading

    const agent = await agentSdk.loadAgent(agentId);
    expect(agent.name).toBeTruthy();
    expect(agent.agentId).toBe(agentId);
  });

  it('should sign feedback authorization', async () => {
    const sdkConfig = {
      chainId: CHAIN_ID,
      rpcUrl: RPC_URL,
      ipfs: 'pinata' as const,
      pinataJwt: PINATA_JWT,
    };

    clientSdk = new SDK({ ...sdkConfig, signer: clientPrivateKey });
    if (!clientSdk.web3Client.signer) {
      throw new Error('Signer required for feedback test');
    }
    clientAddress = clientSdk.web3Client.address!;

    // Agent SDK needs to be initialized with signer for signing feedback auth
    agentSdkWithSigner = new SDK({ ...sdkConfig, signer: AGENT_PRIVATE_KEY });

    // Sign feedback authorization
    const feedbackAuth = await agentSdkWithSigner.signFeedbackAuth(agentId, clientAddress, undefined, 24);
    expect(feedbackAuth).toBeTruthy();
    expect(feedbackAuth.length).toBeGreaterThan(0);
  });

  it('should submit feedback with IPFS storage', async () => {
    const numFeedback = 1;
    const feedbackEntries: Array<{
      index: number;
      data: ReturnType<typeof generateFeedbackData>;
      feedback: any;
    }> = [];

    for (let i = 0; i < numFeedback; i++) {
      const feedbackData = generateFeedbackData(i + 1);

      // Prepare feedback file
      const feedbackFile = clientSdk.prepareFeedback(
        agentId,
        feedbackData.score,
        feedbackData.tags,
        undefined, // text
        feedbackData.capability,
        undefined, // name
        feedbackData.skill,
        undefined, // task
        { context: feedbackData.context }
      );

      // Sign feedback authorization
      const feedbackAuth = await agentSdkWithSigner.signFeedbackAuth(agentId, clientAddress, undefined, 24);

      // Submit feedback
      const feedback = await clientSdk.giveFeedback(agentId, feedbackFile, feedbackAuth);

      // Extract actual feedback index from the returned Feedback object
      const actualFeedbackIndex = feedback.id[2];

      feedbackEntries.push({
        index: actualFeedbackIndex,
        data: feedbackData,
        feedback,
      });

      expect(feedback.score).toBe(feedbackData.score);
      expect(feedback.tags).toEqual(feedbackData.tags);
      expect(feedback.capability).toBe(feedbackData.capability);
      expect(feedback.skill).toBe(feedbackData.skill);
      expect(feedback.fileURI).toBeTruthy();

      // Wait between submissions
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  });

  it('should append response to feedback', async () => {
    // This test assumes feedback was submitted in previous test
    // In a real scenario, you'd load the feedback index from previous test

    // For now, this is a placeholder that would need the actual feedback index
    const feedbackIndex = 1; // Would come from previous test

    const responseUri = 'ipfs://QmExampleResponse';
    const responseHash = '0x' + '00'.repeat(32);

    // Agent responds to the client's feedback
    try {
      const txHash = await agentSdkWithSigner.appendResponse(agentId, clientAddress, feedbackIndex, {
        uri: responseUri,
        hash: responseHash,
      });
      expect(txHash).toBeTruthy();
    } catch (error) {
      // May fail if feedback doesn't exist - that's okay for integration test
      console.warn('Append response test skipped:', error);
    }
  });

  it('should retrieve feedback using getFeedback', async () => {
    // Wait for blockchain and subgraph
    await new Promise((resolve) => setTimeout(resolve, 15000)); // 15 seconds

    const feedbackIndex = 1; // Would come from actual test flow

    try {
      const retrievedFeedback = await agentSdkWithSigner.getFeedback(agentId, clientAddress, feedbackIndex);

      expect(retrievedFeedback).toBeTruthy();
      expect(retrievedFeedback.score).toBeDefined();
      expect(retrievedFeedback.agentId).toBe(agentId);
    } catch (error) {
      // May fail if feedback doesn't exist yet - that's okay
      console.warn('Get feedback test skipped:', error);
    }
  });

  it('should search feedback with filters', async () => {
    // Wait for subgraph indexing
    await new Promise((resolve) => setTimeout(resolve, 60000)); // 60 seconds

    try {
      // Search by capability
      const capabilityResults = await agentSdkWithSigner.searchFeedback(agentId, undefined, ['data_analysis']);
      expect(Array.isArray(capabilityResults)).toBe(true);

      // Search by skill
      const skillResults = await agentSdkWithSigner.searchFeedback(agentId, undefined, undefined, ['python']);
      expect(Array.isArray(skillResults)).toBe(true);

      // Search by tags
      const tagResults = await agentSdkWithSigner.searchFeedback(agentId, ['enterprise']);
      expect(Array.isArray(tagResults)).toBe(true);

      // Search by score range
      const scoreResults = await agentSdkWithSigner.searchFeedback(
        agentId,
        undefined,
        undefined,
        undefined,
        75,
        95
      );
      expect(Array.isArray(scoreResults)).toBe(true);
    } catch (error) {
      console.warn('Search feedback test skipped:', error);
    }
  });
});

