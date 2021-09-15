// SPDX-License-Identifier: MIT
pragma solidity 0.6.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @notice a voting system (Cf. README.md for details)
 */
contract Voting is Ownable {

    using SafeMath for uint;

    /**
     * @dev By default a `Voter` is not registered, has not voted 
    *         for a proposal yet.
     */
    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint votedProposalId;
    }
    
    /**
     * @dev A proposal holds a descriptive text
     *        and the number votes it received.
     */
    struct Proposal {
        string description;
        uint   voteCount;
    }
    
    /// @dev the different states of the ballot
    enum WorkflowStatus {
        RegisteringVoters,              // 0
        ProposalsRegistrationStarted,   // 1
        ProposalsRegistrationEnded,     // 2
        VotingSessionStarted,           // 3
        VotingSessionEnded,             // 4
        VotesTallied                    // 5
    }

    /// @notice the registered voters as {key=address, value=Voter} pairs
    mapping(address => Voter) public voters;
    
    /// @notice the proposals as {ProposalId => Proposal} pairs
    mapping(uint => Proposal) public proposals;        

    /// @dev id of the winning Proposal
    uint public winningProposalId;

    /// @dev the ids of registered proposals
    uint[] private _proposalIds;

    /// @dev intentionnaly iterate over `proposals` starting at 1 
    ///        (skip over 0, which is the default value used when a proposalId is not set)
    uint private _proposalIndex = 1;
    
    /// @dev the current ballot state
    WorkflowStatus private _currentState;
    

    event VoterRegistered(address _voterAddress);
    event ProposalsRegistrationStarted();
    event ProposalsRegistrationEnded();
    event ProposalRegistered(uint _proposalId);
    event VotingSessionStarted();
    event VotingSessionEnded();
    event Voted(address _voterAddress, uint _proposalId);
    event VotesTallied();
    event WorkflowStatusChange(WorkflowStatus _previousState, WorkflowStatus _newState);

    /**
     * @dev Allow the passed in public address to later on suggest a proposal then vote for one of the proposals.
     * @param _address the public address to allow (ie. add to the white list)
     */
    function registerVoter(address _address) public 
            onlyOwner
    {
        require(
            _currentState == WorkflowStatus.RegisteringVoters ,
            "Cannot register voters at this stage"
        );

        // Register the passed in public address associated to a fresh new Voter  
        // who has not voted nor has a registered a proposal or voted for a proposal yet. 
        voters[_address] = Voter(true, false, 0);

        emit VoterRegistered(_address);
    }
    
    /**
     * @dev Open the proposals registration phase
     */
    function startProposalRegistration() public
            onlyOwner
    {
        require(
            _currentState == WorkflowStatus.RegisteringVoters,
            "Cannot open proposals registration at this stage"
        );

        _currentState = WorkflowStatus.ProposalsRegistrationStarted;

        emit WorkflowStatusChange(WorkflowStatus.RegisteringVoters, WorkflowStatus.ProposalsRegistrationStarted);
        emit ProposalsRegistrationStarted();
    }
    
    /**
     * @dev Close the proposals registration phase
     */
    function endProposalRegistration() public
            onlyOwner
    {
        require(
            _currentState == WorkflowStatus.ProposalsRegistrationStarted, 
            "Cannot end proposal registration at this stage"
        );

        _currentState = WorkflowStatus.ProposalsRegistrationEnded;

        emit WorkflowStatusChange(WorkflowStatus.ProposalsRegistrationStarted, WorkflowStatus.ProposalsRegistrationEnded);
        emit ProposalsRegistrationEnded();
    }
    
    /**
     * @dev The registered `Voter` associated with caller's public address
     *        registers a proposal
     */
    function registerProposal(string memory _proposalDescription) public {
        require(
            _currentState == WorkflowStatus.ProposalsRegistrationStarted, 
            "Cannot register a proposal at this stage"
        );
        require(
            voters[msg.sender].isRegistered,
            "Not registered as a voter"
        );
        require(
            bytes(_proposalDescription).length != 0,
            "Missing Proposal's description"
        );

        proposals[_proposalIndex] = Proposal(_proposalDescription, 0);
        _proposalIds.push(_proposalIndex);
        
        emit ProposalRegistered(_proposalIndex);
        _proposalIndex = _proposalIndex.add(1);
    }
    
    
    /**
     * @dev Start the voting sesion 
     */
    function startVotingSession() public
            onlyOwner
    {
        require(
            _currentState == WorkflowStatus.ProposalsRegistrationEnded,
            "Cannot start the voting session at this stage"
        );

        _currentState = WorkflowStatus.VotingSessionStarted;
        
        emit WorkflowStatusChange(WorkflowStatus.ProposalsRegistrationEnded, WorkflowStatus.VotingSessionStarted);
        emit VotingSessionStarted();
    }
    
    /**
     * @dev The registered `Voter` associated with the caller's public
     *         address casts a vote for a proposal.
     */
    function vote(uint _proposalId) public {
        require(
            _currentState == WorkflowStatus.VotingSessionStarted,
            "Cannot vote at this stage"
        );
        require(
            voters[msg.sender].isRegistered,
            "Not a registered voter"
        );
        require(
            ! voters[msg.sender].hasVoted,
            "Already voted"
        );
        
        voters[msg.sender].hasVoted        = true;
        voters[msg.sender].votedProposalId = _proposalId;
        proposals[_proposalId].voteCount   = proposals[_proposalId].voteCount.add(1);

       emit Voted(msg.sender, _proposalId);       
    }

    /**
     * @dev Close the voting sesion 
     */
    function endVotingSession() public
            onlyOwner
    {
        require(
            _currentState == WorkflowStatus.VotingSessionStarted,
            "Cannot end the voting session at this stage"
        );

        _currentState = WorkflowStatus.VotingSessionEnded;

        emit WorkflowStatusChange(
            WorkflowStatus.VotingSessionStarted, 
            WorkflowStatus.VotingSessionEnded
        );
        emit VotingSessionEnded();
    }
    
    /**
     *  @dev Tally the votes
     *         The most voted proposal wins.
     * */
    function tallyVotes() public 
            onlyOwner
    {
        require(
            _currentState == WorkflowStatus.VotingSessionEnded,
            "Cannot tally votes at this stage"
        );

        uint maxVotes = 0;        
        
        // Find the id of the most voted proposal
        for (uint i=1; i < _proposalIndex; i = i.add(1)) {
            if (proposals[i].voteCount > maxVotes) {
                winningProposalId = i;
                maxVotes          = proposals[i].voteCount;
            }
        }
        
        emit WorkflowStatusChange(
            WorkflowStatus.VotingSessionEnded,
            WorkflowStatus.VotesTallied
        );
        emit VotesTallied();
    }
    
    /**
     * @return the ids of all the registered proposals.
     */
    function getProposalIds() public view returns (uint[] memory) {
        return _proposalIds;
    }

    /**
     *  @return the description and vote count of a proposal with a given id.
     *  @param _proposalId the id of a proposal we want to get the details of
     */
    function getProposal(uint _proposalId) public view 
            returns(string memory, uint)
    {
        Proposal memory proposal = proposals[_proposalId];

        return (proposal.description, proposal.voteCount);
    }
}
