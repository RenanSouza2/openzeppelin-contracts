// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC721/extensions/ERC721Votes.sol)

pragma solidity ^0.8.0;

import "../ERC721.sol";
import "../../../governance/utils/Votes.sol";

/**
 * @dev Extension of ERC721 to support voting and delegation as implemented by {Votes}, where each individual NFT counts
 * as 1 vote unit.
 *
 * Tokens do not count as votes until they are delegated, because votes must be tracked which incurs an additional cost
 * on every transfer. Token holders can either delegate to a trusted representative who will decide how to make use of
 * the votes in governance decisions, or they can delegate to themselves to be their own representative.
 *
 * _Available since v4.5._
 */
abstract contract ERC721Votes is ERC721, Votes {
    /**
     * @dev Returns the balance of `account`.
     */
    function _getVotingUnits(address account) internal view virtual override returns (uint256) {
        return balanceOf(account);
    }
    /**
     * @dev See {ERC721-_afterTokenTransfer}. Adjusts votes when tokens are transferred.
     *
     * Emits a {IVotes-DelegateVotesChanged} event.
     */
    function _update(
        address from, 
        address to, 
        uint256 tokenId, 
        bool safe, 
        bytes memory data
    ) internal virtual override {
        super._update(from, to, tokenId, safe, data);
        _transferVotingUnits(from, to, 1);
    }


    function _increaseBalance(address to, uint256 batchSize) internal virtual override {
        super._increaseBalance(to, batchSize);
        _transferVotingUnits(address(0), to, batchSize);
    }
}