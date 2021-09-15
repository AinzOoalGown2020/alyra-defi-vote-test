//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Test the ERC20Token smart-contract
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
const { expectEvent, expectRevert, BN } = require('@openzeppelin/test-helpers');
const { expect }       = require('chai');

const Voting = artifacts.require('Voting');

// MUST be kept in sync with Voting.WorkflowStatus
const WorkflowStatus = {
    RegisteringVoters:            new BN(0),
    ProposalsRegistrationStarted: new BN(1),
    ProposalsRegistrationEnded:   new BN(2),
    VotingSessionStarted:         new BN(3),
    VotingSessionEnded:           new BN(4),
    VotesTallied:                 new BN(5)
};

contract('Voting', function(accounts) {

    const ownerAddress     = accounts[0];
    const voter1Address    = accounts[1];
    const voter2Address    = accounts[2];
    const voter3Address    = accounts[3];
    const notVoter4Address = accounts[4];

    // Instantiate a new Voting contract before running each test in this suite
    beforeEach(async function () {
        this.votingInstance = await Voting.new( {from: ownerAddress});
    })
    

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // RegisteringVoters
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    describe("When RegisteringVoters", function() {

        it ("cannot register a voter if not owner", async function() {
            const notOwnerAddress = voter2Address;

            await expectRevert(
                this.votingInstance.registerVoter(
                    voter1Address,
                    { from: notOwnerAddress }
                ),
                "Ownable: caller is not the owner"
            );
        })

        it ("can register a voter if owner ", async function() {
            expect((await this.votingInstance.voters.call(voter1Address)).isRegistered)
                .to.be.false;

            const result = await this.votingInstance.registerVoter(
                voter1Address,
                { from: ownerAddress }
            );

            expect((await this.votingInstance.voters.call(voter1Address)).isRegistered)
                .to.be.true;
            expectEvent(result, "VoterRegistered", { _voterAddress: voter1Address });
        })

        it ("can startProposalRegistration if owner", async function() {
            await this.votingInstance.registerVoter(
                voter1Address,
                { from: ownerAddress }
            );
            await this.votingInstance.registerVoter(
                voter2Address,
                { from: ownerAddress }
            );

            const result = await this.votingInstance.startProposalRegistration(
                { from: ownerAddress }
            );

            expectEvent(
                result, 
                "WorkflowStatusChange",
                { 
                    _previousState: WorkflowStatus.RegisteringVoters,
                    _newState:      WorkflowStatus.ProposalsRegistrationStarted
                }
            );
            expectEvent(result, "ProposalsRegistrationStarted");
        })

        it ("cannot startProposalRegistration if not owner", async function() {
            const notOwnerAddress = voter2Address;

            await expectRevert(
                this.votingInstance.startProposalRegistration(
                    { from: notOwnerAddress }
                ),
                "Ownable: caller is not the owner"
            );
        })

        it ("cannot registerProposal", async function () {
            await expectRevert(
                this.votingInstance.registerProposal(
                    "Proposal description",
                    { from: voter1Address }
                ),
                "Cannot register a proposal at this stage"
            );
        })

        it ("cannot endProposalRegistration", async function () {
            await expectRevert(
                this.votingInstance.endProposalRegistration(
                    { from: ownerAddress }
                ),
                "Cannot end proposal registration at this stage"
            );
        })

        it ("cannot startVotingSession", async function () {
            await expectRevert(
                this.votingInstance.startVotingSession(
                    { from: ownerAddress }
                ),
                "Cannot start the voting session at this stage"
            );
        })

        it ("cannot vote", async function () {
            await expectRevert(
                this.votingInstance.vote( 1, { from: ownerAddress }),
                "Cannot vote at this stage"
            );
        })

        it ("cannot endVotingSession", async function () {
            await expectRevert(
                this.votingInstance.endVotingSession(
                    { from: ownerAddress }
                ),
                "Cannot end the voting session at this stage"
            );
        })

        it ("cannot tallyVotes", async function () {
            await expectRevert(
                this.votingInstance.tallyVotes( { from: ownerAddress }),
                "Cannot tally votes at this stage"
            );
        })

        it ("has no winningProposal yet", async function () {
            const winningProposalId = await this.votingInstance.winningProposalId.call();
            const noWinner          = new BN(0);

            expect(winningProposalId)
                .to.be.bignumber
                .equal(noWinner);
        })
    })

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // ProposalsRegistrationStarted
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    describe ("When ProposalsRegistrationStarted", function () {

        it ("cannot registerVoter", async function( ){
            await this.votingInstance.startProposalRegistration(
                { from: ownerAddress }
            );

            await expectRevert(
                this.votingInstance.registerVoter(
                    voter1Address,
                    { from: ownerAddress }
                ),
                "Cannot register voters at this stage"
            );
        })

        it ("cannot startProposalRegistration", async function () {
            await this.votingInstance.startProposalRegistration(
                { from: ownerAddress }
            );

            await expectRevert(
                this.votingInstance.startProposalRegistration(
                    { from: ownerAddress }
                ),
                "Cannot open proposals registration at this stage"
            );
        })

        it ("can registerProposal and getProposalIds", async function () {
            // Given 2 registered voters (voter1, voter2)
            await this.votingInstance.registerVoter(
                voter1Address,
                { from: ownerAddress }
            );
            await this.votingInstance.registerVoter(
                voter2Address,
                { from: ownerAddress }
            );

            // Given the proposal registration is started
            await this.votingInstance.startProposalRegistration(
                { from: ownerAddress }
            );

            // Then voter1 should be able to register his proposal
            expectEvent(
                await this.votingInstance.registerProposal(
                    "Proposal 1",
                    { from: voter1Address }
                ), 
                "ProposalRegistered", 
                { _proposalId: new BN(1) } // First registered proposal should have id 1
            );

            // Then voter2 should be able to register his proposal
            expectEvent(
                await this.votingInstance.registerProposal(
                    "Proposal 2",
                    { from: voter2Address }
                ),
                "ProposalRegistered",
                { _proposalId: new BN(2) }
            );

            // Then there should be 2 registered proposals
            expect(await this.votingInstance.getProposalIds())
                .be.an('array')
                .with.lengthOf(2)
            ;
            const proposal1 = await this.votingInstance.getProposal(new BN(1));
            expect(proposal1[0])
                .to.be.a('string')
                .equal("Proposal 1", "Proposal description should be the first returned value")
            ;
            expect(proposal1[1])
                .to.be.a.bignumber
                .equal(new BN(0), "Proposal 1 should not have 0 vote")
            ;

            const proposal2 = await this.votingInstance.getProposal(new BN(2));
            expect(proposal2[0])
                .to.be.a('string')
                .equal("Proposal 2", "Proposal 2 description should be the first returned value")
            ;
            expect(proposal2[1])
                .to.be.a.bignumber
                .equal(new BN(0), "Proposal 2 should not have 0 vote")
            ;
        })

        it ("can endProposalRegistration if owner", async function () {
            await this.votingInstance.registerVoter(
                voter1Address,
                { from: ownerAddress }
            );
            await this.votingInstance.registerVoter(
                voter2Address,
                { from: ownerAddress }
            );

            await this.votingInstance.startProposalRegistration(
                { from: ownerAddress }
            );

            const result = await this.votingInstance.endProposalRegistration(
                { from: ownerAddress }
            );

            expectEvent(
                result,
                "WorkflowStatusChange",
                { 
                    _previousState: WorkflowStatus.ProposalsRegistrationStarted,
                    _newState:      WorkflowStatus.ProposalsRegistrationEnded
                }
            );
            expectEvent(result, "ProposalsRegistrationEnded");
        })

        it ("cannot endProposalRegistration if not owner", async function () {
            await this.votingInstance.registerVoter(
                voter1Address,
                { from: ownerAddress }
            );
            await this.votingInstance.registerVoter(
                voter2Address,
                { from: ownerAddress }
            );

            await this.votingInstance.startProposalRegistration(
                { from: ownerAddress }
            );

            const notOwner = voter3Address;
            await expectRevert(
                this.votingInstance.endProposalRegistration(
                    { from:  notOwner }
                ),
                "Ownable: caller is not the owner"
            );
        })

        it ("cannot startVotingSession", async function () {
            await expectRevert(
                this.votingInstance.startVotingSession(
                    { from: ownerAddress }
                ),
                "Cannot start the voting session at this stage"
            );
        })

        it ("cannot vote", async function () {
            await expectRevert(
                this.votingInstance.vote( 1, { from: ownerAddress }),
                "Cannot vote at this stage"
            );
        })

        it ("cannot endVotingSession", async function () {
            await expectRevert(
                this.votingInstance.endVotingSession(
                    { from: ownerAddress }
                ),
                "Cannot end the voting session at this stage"
            );
        })

        it ("cannot tallyVotes", async function () {
            await expectRevert(
                this.votingInstance.tallyVotes( { from: ownerAddress }),
                "Cannot tally votes at this stage"
            );
        })

    })

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // ProposalsRegistrationEnded
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    describe("When ProposalsRegistrationEnded", function() {

        // To prevent test functions in this block 
        // from being cluttered with the same redundant code, we put it here once
        // so that it is executed before each function inside the describe block above.
        // ~~~~~~~~~~~~
        beforeEach( async function () { 
            await this.votingInstance.registerVoter(
                voter1Address,
                { from: ownerAddress }
            );
            await this.votingInstance.registerVoter(
                voter2Address,
                { from: ownerAddress }
            );

            await this.votingInstance.startProposalRegistration(
                { from: ownerAddress }
            );

            await this.votingInstance.registerProposal(
                "Proposition 1",
                { from: voter1Address }
            );
            await this.votingInstance.registerProposal(
                "Proposition 2",
                { from: voter2Address }
            );

            await this.votingInstance.endProposalRegistration(
                { from: ownerAddress }
            );
        })

        it ("cannot registerVoter", async function () {
            await expectRevert(
                this.votingInstance.registerVoter(
                    voter1Address,
                    { from: ownerAddress }
                ),
                "Cannot register voters at this stage"
            );
        })

        it ("cannot startProposalRegistration", async function () {
            await expectRevert(
                this.votingInstance.startProposalRegistration(
                    { from: ownerAddress }
                ),
                "Cannot open proposals registration at this stage"
            );
        })

        it ("cannot registerProposal", async function () {
            await expectRevert(
                this.votingInstance.registerProposal(
                    "Proposal description",
                    { from: voter1Address }
                ),
                "Cannot register a proposal at this stage"
            );
        })

        it ("cannot endProposalRegistration", async function () {
            await expectRevert(
                this.votingInstance.endProposalRegistration(
                    { from: ownerAddress }
                ),
                "Cannot end proposal registration at this stage"
            );
        })

        it ("can startVotingSession if owner", async function () {
            const result = await this.votingInstance.startVotingSession(
                { from: ownerAddress }
            );

            expectEvent(result, "WorkflowStatusChange", { 
                _previousState: WorkflowStatus.ProposalsRegistrationEnded, 
                _newState: WorkflowStatus.VotingSessionStarted 
            });
            expectEvent(result, "VotingSessionStarted");
        })

        it ("cannot startVotingSession if not owner", async function () {
            const notOwnerAddress = voter3Address;

            await expectRevert(
                this.votingInstance.startVotingSession(
                    { from: notOwnerAddress }
                ),
                "Ownable: caller is not the owner"
            );
        })

        it ("cannot endVotingSession", async function () {
            await expectRevert(
                this.votingInstance.endVotingSession(
                    { from: ownerAddress }
                ),
                "Cannot end the voting session at this stage"
            );
        })

        it ("cannot vote", async function () {
            await expectRevert(
                this.votingInstance.vote(
                    new BN(0)
                    ,{ from: ownerAddress }
                ),
                "Cannot vote at this stage"
            );
        })

        it ("cannot tallyVotes", async function () {
            await expectRevert(
                this.votingInstance.tallyVotes(
                    { from: ownerAddress }
                ),
                "Cannot tally votes at this stage"
            );
        })
    })

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // VotingSessionStarted
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    describe("When VotingSessionStarted", function() {

        // ~~~~~~~~~~~~~~~~~~~~~~~
        // run before each test method in the above describe block
        beforeEach( async function () {
            await this.votingInstance.registerVoter(
                voter1Address,
                { from: ownerAddress }
            );
            await this.votingInstance.registerVoter(
                voter2Address,
                { from: ownerAddress }
            );

            await this.votingInstance.startProposalRegistration(
                { from: ownerAddress }
            );

            await this.votingInstance.registerProposal(
                "Proposal 1",
                { from: voter1Address }
            );

            await this.votingInstance.registerProposal(
                "Proposal 2",
                { from: voter2Address }
            );

            await this.votingInstance.endProposalRegistration(
                { from: ownerAddress }
            );

            await this.votingInstance.startVotingSession(
                { from: ownerAddress }
            );
        })

        it ("cannot registerVoter", async function () {
            await expectRevert(
                this.votingInstance.registerVoter(
                    voter1Address,
                    { from: ownerAddress }
                ),
                "Cannot register voters at this stage"
            );
        })

        it ("cannot startProposalRegistration", async function () {
            await expectRevert(
                this.votingInstance.startProposalRegistration(
                    { from: ownerAddress }
                ),
                "Cannot open proposals registration at this stage"
            );
        })

        it ("cannot registerProposal", async function () {
            await expectRevert(
                this.votingInstance.registerProposal(
                    "Proposal description",
                    { from: voter1Address }
                ),
                "Cannot register a proposal at this stage"
            );
        })

        it ("cannot endProposalRegistration", async function () {
            await expectRevert(
                this.votingInstance.endProposalRegistration(
                    { from: ownerAddress }
                ),
                "Cannot end proposal registration at this stage"
            );
        })

        it ("cannot startVotingSession", async function () {
            await expectRevert(
                this.votingInstance.startVotingSession(
                    { from: ownerAddress }
                ),
                "Cannot start the voting session at this stage"
            );
        })

        it ("can vote if registered voter", async function () {
            // Given no vote for proposal 1 yet
            const proposalId1 = new BN(1);
            const proposal1Before = await this.votingInstance.getProposal(proposalId1);
            expect(proposal1Before[0])
                .to.be.a("string")
                .equal("Proposal 1", "Proposal 1 should have this description");
            expect(proposal1Before[1])
                .to.be.a.bignumber
                .equal(new BN(0), "Proposal 1 should not have 0 vote");

            // When voter 1 casts a vote for "Proposal 1"
            const resultVote = await this.votingInstance.vote(
                proposalId1,
                { from: voter1Address }
            );

            // Then
            expectEvent(resultVote, "Voted", {
                    _voterAddress: voter1Address,
                    _proposalId:   new BN(1),
                },
                "Voter 1 should have voted for Proposal 1"
            );

            const proposal1After = await this.votingInstance.getProposal(proposalId1);
            expect(proposal1After[0])
                .to.be.a("string")
                .equal("Proposal 1", "Proposal 1 description should be unchanged");
            expect(proposal1After[1]) 
                .to.be.a.bignumber
                .equal(new BN(1), "Proposal 1 should have 1 vote");
        })

        it ("cannot vote if not a registered voter", async function () {
            const notRegisteredVoter = voter3Address;

            await expectRevert(
                this.votingInstance.vote(
                    new BN(2),
                    { from: notRegisteredVoter }
                ),
                "Not a registered voter"
            );
        })

        it ("cannot vote more than once", async function () {
            // When voter2 votes once
            const proposal2 = new BN(2);            
            this.votingInstance.vote(
                proposal2,
                { from: voter2Address }
            );

            // Then a voter cannot vote more than once
            await expectRevert(
                this.votingInstance.vote(
                    proposal2,
                    { from: voter2Address }
                ),
                "Already voted"
            );
        })

        it ("can endVotingSession if owner", async function () {
            const result = await this.votingInstance.endVotingSession(
                { from: ownerAddress }
            );

            expectEvent(
                result, 
                "WorkflowStatusChange", 
                {
                    _previousState: WorkflowStatus.VotingSessionStarted,    
                    _newState:      WorkflowStatus.VotingSessionEnded
                }
            );
            expectEvent(result, "VotingSessionEnded");
        })

        it ("cannot endVotingSession if not owner", async function () {
            const notOwnerAddress = voter3Address;

            await expectRevert(
                this.votingInstance.endVotingSession(
                    { from: notOwnerAddress }
                ),
                "Ownable: caller is not the owner"
            );
        })

        it ("cannot tallyVotes", async function () {
            await expectRevert(
                this.votingInstance.tallyVotes(
                    { from: ownerAddress }
                ),
                "Cannot tally votes at this stage"
            );
        })
    })
    
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // VotingSessionEnded
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    describe("When VotingSessionEnded", function() {

        // ~~~~~~~~~~~~~~~~~~~~~~~
        // run before each test method in the above describe block
        beforeEach( async function () { 
            await this.votingInstance.registerVoter(
                voter1Address,
                { from: ownerAddress }
            );
            await this.votingInstance.registerVoter(
                voter2Address,
                { from: ownerAddress }
            );
            await this.votingInstance.registerVoter(
                voter3Address,
                { from: ownerAddress }
            );

            await this.votingInstance.startProposalRegistration(
                { from: ownerAddress }
            );

            await this.votingInstance.registerProposal(
                "Proposition 1",
                { from: voter1Address }
            );
            await this.votingInstance.registerProposal(
                "Proposition 2",
                { from: voter2Address }
            );

            await this.votingInstance.endProposalRegistration(
                { from: ownerAddress }
            );

            await this.votingInstance.startVotingSession(
                { from: ownerAddress }
            );

            await this.votingInstance.vote(new BN(1), { from: voter1Address});
            await this.votingInstance.vote(new BN(2), { from: voter2Address});
            await this.votingInstance.vote(new BN(2), { from: voter3Address});

            await this.votingInstance.endVotingSession(
                { from: ownerAddress }
            );
        })

        it ("cannot registerVoter", async function () {
            await expectRevert(
                this.votingInstance.registerVoter(
                    voter1Address,
                    { from: ownerAddress }
                ),
                "Cannot register voters at this stage"
            );
        })

        it ("cannot startProposalRegistration", async function () {
            await expectRevert(
                this.votingInstance.startProposalRegistration(
                    { from: ownerAddress }
                ),
                "Cannot open proposals registration at this stage"
            );
        })

        it ("cannot registerProposal", async function () {
            await expectRevert(
                this.votingInstance.registerProposal(
                    "Proposal description",
                    { from: voter1Address }
                ),
                "Cannot register a proposal at this stage"
            );
        })

        it ("cannot endProposalRegistration", async function () {
            await expectRevert(
                this.votingInstance.endProposalRegistration(
                    { from: ownerAddress }
                ),
                "Cannot end proposal registration at this stage"
            );
        })

        it ("cannot startVotingSession", async function () {
            await expectRevert(
                this.votingInstance.startVotingSession(
                    { from: ownerAddress }
                ),
                "Cannot start the voting session at this stage"
            );
        })

        it ("cannot vote", async function () {
            await expectRevert(
                this.votingInstance.vote(
                    new BN(2),
                    { from: voter2Address }
                ),
                "Cannot vote at this stage"
            );
        })

        it ("can tallyVotes", async function () {                        
            const result = await this.votingInstance.tallyVotes(
                { from: ownerAddress }
            );

            expectEvent(result, "VotesTallied");

            const actualWinningProposalId = await this.votingInstance.winningProposalId.call();
            expect(actualWinningProposalId)
                .to.be.bignumber
                .equal(new BN(2));
        })

    })

})

