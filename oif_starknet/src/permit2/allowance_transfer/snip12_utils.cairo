use core::hash::{HashStateExTrait, HashStateTrait};
use core::poseidon::PoseidonTrait;
use oif_starknet::permit2::allowance_transfer::interface::{
    PermitBatch, PermitDetails, PermitSingle,
};
use openzeppelin_utils::cryptography::snip12::{
    SNIP12HashSpanImpl, StarknetDomain, StructHash, StructHashStarknetDomainImpl,
};
use starknet::get_tx_info;

/// Utils (move for re-use) ///

// @dev need to setup domain config/init/etc
pub fn DOMAIN() -> StarknetDomain {
    StarknetDomain {
        name: 'dApp name', version: '1', chain_id: get_tx_info().unbox().chain_id, revision: 1,
    }
}

/// SNIP-12 TYPE_HASHES ///
/// - u256
/// - PermitDetails
/// - PermitSingle
/// - PermitBatch

pub const U256_TYPE_HASH: felt252 = selector!("\"u256\"(\"low\":\"u128\",\"high\":\"u128\")");

// @dev There's no u8 in SNIP-12, we use u128
pub const PERMIT_DETAILS_TYPEHASH: felt252 = selector!(
    "\"PermitDetails\"(\"token\":\"ContractAddress\",\"amount\":\"u256\",\"expiration\":\"u128\",\"nonce\":\"u128\")\"u256\"(\"low\":\"u128\",\"high\":\"u128\")",
);

pub const PERMIT_SINGLE_TYPEHASH: felt252 = selector!(
    "\"PermitSingle\"(\"details\":\"PermitDetails\",\"spender\":\"ContractAddress\",\"sig_deadline\":\"u256\")\"PermitDetails\"(\"token\":\"ContractAddress\",\"amount\":\"u256\",\"expiration\":\"u128\",\"nonce\":\"u128\")\"u256\"(\"low\":\"u128\",\"high\":\"u128\")",
);

pub const PERMIT_BATCH_TYPEHASH: felt252 = selector!(
    "\"PermitBatch\"(\"details\":\"PermitDetails*\",\"spender\":\"ContractAddress\",\"sig_deadline\":\"u256\")\"PermitDetails\"(\"token\":\"ContractAddress\",\"amount\":\"u256\",\"expiration\":\"u128\",\"nonce\":\"u128\")\"u256\"(\"low\":\"u128\",\"high\":\"u128\")",
);

/// HASHING STRUCTS ///
/// - u256
/// - PermitDetails
/// - PermitSingle
/// - PermitBatch

// @note: Can condense with signature_transfer::U256StructHash
pub impl U256StructHash of StructHash<u256> {
    fn hash_struct(self: @u256) -> felt252 {
        PoseidonTrait::new().update_with(U256_TYPE_HASH).update_with(*self).finalize()
    }
}

pub impl PermitDetailsStructHash of StructHash<PermitDetails> {
    fn hash_struct(self: @PermitDetails) -> felt252 {
        PoseidonTrait::new()
            .update_with(PERMIT_DETAILS_TYPEHASH)
            .update_with(*self.token)
            .update_with(self.amount.hash_struct())
            .update_with(*self.expiration)
            .update_with(*self.nonce)
            .finalize()
    }
}

pub impl PermitSingleStructHash of StructHash<PermitSingle> {
    fn hash_struct(self: @PermitSingle) -> felt252 {
        PoseidonTrait::new()
            .update_with(PERMIT_SINGLE_TYPEHASH)
            .update_with(self.details.hash_struct())
            .update_with(*self.spender)
            .update_with(self.sig_deadline.hash_struct())
            .finalize()
    }
}

pub impl PermitBatchStructHash of StructHash<PermitBatch> {
    fn hash_struct(self: @PermitBatch) -> felt252 {
        let hashed_details = self
            .details
            .into_iter()
            .map(|detail| detail.hash_struct())
            .collect::<Array<felt252>>()
            .span();

        PoseidonTrait::new()
            .update_with(PERMIT_BATCH_TYPEHASH)
            .update_with(hashed_details)
            .update_with(*self.spender)
            .update_with(self.sig_deadline.hash_struct())
            .finalize()
    }
}
