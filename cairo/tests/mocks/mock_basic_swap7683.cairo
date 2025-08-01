use alexandria_bytes::Bytes;
use starknet::ContractAddress;
use oif_starknet::libraries::order_encoder::{
    OrderData, OrderEncoder, OpenOrderEncoderImpl, OpenOrderEncoderImplAt,
};
use oif_starknet::erc7683::interface::{
    GaslessCrossChainOrder, OnchainCrossChainOrder, ResolvedCrossChainOrder,
};
#[starknet::interface]
pub trait IMockBasicSwap7683<TState> {
    fn fill_order(ref self: TState, order_id: u256, origin_data: Bytes, _empty: Bytes, value: u256);
    fn settle_order(
        ref self: TState,
        order_ids: Array<u256>,
        orders_origin_data: Array<Bytes>,
        orders_filler_data: Array<Bytes>,
        value: u256,
    );

    fn refund_gasless_orders(
        ref self: TState,
        orders: Array<GaslessCrossChainOrder>,
        order_ids: Array<u256>,
        value: u256,
    );

    fn refund_onchain_orders(
        ref self: TState,
        orders: Array<OnchainCrossChainOrder>,
        order_ids: Array<u256>,
        value: u256,
    );

    fn resolve_gasless_order(
        self: @TState, order: GaslessCrossChainOrder, _dummy: Bytes,
    ) -> (ResolvedCrossChainOrder, u256, felt252);

    fn resolve_onchain_order(
        self: @TState, order: OnchainCrossChainOrder,
    ) -> (ResolvedCrossChainOrder, u256, felt252);

    fn resolved_order(
        self: @TState,
        order_type: felt252,
        sender: ContractAddress,
        open_deadline: u64,
        fill_deadline: u64,
        order_data: Bytes,
    ) -> ResolvedCrossChainOrder;

    fn handle_settle_order(
        ref self: TState,
        message_origin: u32,
        message_sender: ContractAddress,
        order_id: u256,
        receiver: ContractAddress,
    );

    fn handle_refund_order(
        ref self: TState, message_origin: u32, message_sender: ContractAddress, order_id: u256,
    );

    fn set_order_opened(ref self: TState, order_id: u256, order_data: OrderData);

    fn get_gasless_order_id(self: @TState, order: GaslessCrossChainOrder) -> u256;

    fn get_onchain_order_id(self: @TState, order: OnchainCrossChainOrder) -> u256;
}

#[starknet::contract]
pub mod MockBasicSwap7683 {
    use oif_starknet::basic_swap7683::BasicSwap7683Component::Virtual;
    use alexandria_bytes::{Bytes, BytesStore};
    use core::keccak::compute_keccak_byte_array;
    use core::num::traits::Bounded;
    use oif_starknet::base7683::Base7683Component;
    use oif_starknet::base7683::Base7683Component::{DestinationSettler, OriginSettler};
    use oif_starknet::basic_swap7683::BasicSwap7683Component;
    use oif_starknet::erc7683::interface::{
        FillInstruction, GaslessCrossChainOrder, OnchainCrossChainOrder, Output,
        ResolvedCrossChainOrder,
    };
    use openzeppelin_utils::cryptography::snip12::StructHashStarknetDomainImpl;
    use starknet::ContractAddress;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use super::{*};

    /// COMPONENT INJECTION ///
    component!(path: Base7683Component, storage: base7683, event: Base7683Event);
    component!(path: BasicSwap7683Component, storage: basic_swap7683, event: BasicSwap7683Event);

    /// EXTERNAL ///
    /// Base7683
    #[abi(embed_v0)]
    pub impl OriginSettlerImpl =
        Base7683Component::OriginSettlerImpl<ContractState>;
    #[abi(embed_v0)]
    impl DestinationSettlerImpl =
        Base7683Component::DestinationSettlerImpl<ContractState>;
    #[abi(embed_v0)]
    pub impl ExtraImpl = Base7683Component::ERC7683ExtraImpl<ContractState>;
    /// BasicSwap7683

    /// INTERNAL ///
    impl BaseInternalImpl = Base7683Component::InternalImpl<ContractState>;
    pub impl BasicSwap7683Impl = BasicSwap7683Component::InternalImpl<ContractState>;

    /// STORAGE ///
    #[storage]
    pub struct Storage {
        dispatched_origin_domain: u32,
        dispatched_order_ids: Map<usize, u256>,
        dispatched_order_ids_len: usize,
        dispatched_orders_filler_data: Map<usize, Bytes>,
        dispatched_orders_filler_data_len: usize,
        ///////////
        native: bool,
        input_token: ContractAddress,
        output_token: ContractAddress,
        counterpart: ContractAddress,
        origin: u32,
        destination: u32,
        filled_id: u256,
        filled_origin_data: Bytes,
        filled_filler_data: Bytes,
        settled_order_ids: Map<usize, u256>,
        settled_orders_origin_data: Map<usize, Bytes>,
        settled_orders_filler_data: Map<usize, Bytes>,
        settled_order_ids_len: usize,
        settled_orders_origin_data_len: usize,
        settled_orders_filler_data_len: usize,
        refunded_order_ids: Map<usize, u256>,
        refunded_order_ids_len: usize,
        /// COMPONENT STORAGE ///
        #[substorage(v0)]
        base7683: Base7683Component::Storage,
        #[substorage(v0)]
        basic_swap7683: BasicSwap7683Component::Storage,
    }

    /// CONSTRUCTOR ///
    #[constructor]
    fn constructor(
        ref self: ContractState,
        permit2: ContractAddress,
        local: u32,
        remote: u32,
        input_token: ContractAddress,
        output_token: ContractAddress,
    ) {
        self.base7683._initialize(permit2);
        self.origin.write(local);
        self.destination.write(remote);
        self.input_token.write(input_token);
        self.output_token.write(output_token);
    }

    /// EVENTS ///
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        Base7683Event: Base7683Component::Event,
        #[flat]
        BasicSwap7683Event: BasicSwap7683Component::Event,
    }

    /// EXTRA PUBLIC ///
    #[abi(embed_v0)]
    pub impl MockBasicSwap7683Impl of super::IMockBasicSwap7683<ContractState> {
        fn fill_order(
            ref self: ContractState, order_id: u256, origin_data: Bytes, _empty: Bytes, value: u256,
        ) {
            BasicSwap7683Component::InternalImpl::_fill_order(
                ref self.base7683, order_id, @origin_data, @_empty,
            );
        }

        fn settle_order(
            ref self: ContractState,
            order_ids: Array<u256>,
            orders_origin_data: Array<Bytes>,
            orders_filler_data: Array<Bytes>,
            value: u256,
        ) {
            BasicSwap7683Component::InternalImpl::_settle_orders(
                ref self.basic_swap7683,
                @order_ids,
                @orders_origin_data,
                @orders_filler_data,
                value,
            );
        }

        fn refund_gasless_orders(
            ref self: ContractState,
            orders: Array<GaslessCrossChainOrder>,
            order_ids: Array<u256>,
            value: u256,
        ) {
            self.basic_swap7683._refund_gasless_orders(@orders, @order_ids, value);
        }

        fn refund_onchain_orders(
            ref self: ContractState,
            orders: Array<OnchainCrossChainOrder>,
            order_ids: Array<u256>,
            value: u256,
        ) {
            self.basic_swap7683._refund_onchain_orders(@orders, @order_ids, value);
        }

        fn resolve_gasless_order(
            self: @ContractState, order: GaslessCrossChainOrder, _dummy: Bytes,
        ) -> (ResolvedCrossChainOrder, u256, felt252) {
            BasicSwap7683Component::InternalImpl::_resolve_gasless_order(
                self.base7683, @order, @_dummy,
            )
        }

        fn resolve_onchain_order(
            self: @ContractState, order: OnchainCrossChainOrder,
        ) -> (ResolvedCrossChainOrder, u256, felt252) {
            BasicSwap7683Component::InternalImpl::_resolve_onchain_order(self.base7683, @order)
        }

        fn resolved_order(
            self: @ContractState,
            order_type: felt252,
            sender: ContractAddress,
            open_deadline: u64,
            fill_deadline: u64,
            order_data: Bytes,
        ) -> ResolvedCrossChainOrder {
            let (resolved_order, _, _) = BasicSwap7683Component::InternalImpl::_resolved_order(
                self.base7683, order_type, sender, open_deadline, fill_deadline, @order_data,
            );
            resolved_order
        }

        fn handle_settle_order(
            ref self: ContractState,
            message_origin: u32,
            message_sender: ContractAddress,
            order_id: u256,
            receiver: ContractAddress,
        ) {
            BasicSwap7683Component::InternalImpl::_handle_settle_order(
                ref self.basic_swap7683, message_origin, message_sender, order_id, receiver,
            )
        }

        fn handle_refund_order(
            ref self: ContractState,
            message_origin: u32,
            message_sender: ContractAddress,
            order_id: u256,
        ) {
            BasicSwap7683Component::InternalImpl::_handle_refund_order(
                ref self.basic_swap7683, message_origin, message_sender, order_id,
            )
        }

        fn set_order_opened(ref self: ContractState, order_id: u256, order_data: OrderData) {
            let order = OrderEncoder::encode(@order_data);
            self
                .base7683
                .open_orders
                .entry(order_id)
                .write((OrderEncoder::order_data_type_hash(), order).encode())
        }

        fn get_gasless_order_id(self: @ContractState, order: GaslessCrossChainOrder) -> u256 {
            self.basic_swap7683._get_order_id(order.order_data_type, order.order_data)
        }

        fn get_onchain_order_id(self: @ContractState, order: OnchainCrossChainOrder) -> u256 {
            self.basic_swap7683._get_order_id(order.order_data_type, order.order_data)
        }
    }

    /// INTERNAL ///
    #[generate_trait]
    pub impl InternalImpl of InternalTrait {
        fn __resolved_order(
            self: @Base7683Component::ComponentState<ContractState>,
            sender: ContractAddress,
            open_deadline: u64,
            fill_deadline: u64,
            order_data: Bytes,
        ) -> (ResolvedCrossChainOrder, u256, felt252) {
            let self = self.get_contract();

            let max_spent = array![
                Output {
                    token: self.output_token.read(),
                    amount: 100,
                    recipient: self.counterpart.read(),
                    chain_id: self.destination.read(),
                },
            ];

            let min_received = array![
                Output {
                    token: self.input_token.read(),
                    amount: 100,
                    recipient: 0.try_into().unwrap(),
                    chain_id: self.origin.read(),
                },
            ];

            let fill_instructions = array![
                FillInstruction {
                    destination_chain_id: self.destination.read(),
                    destination_settler: self.counterpart.read(),
                    origin_data: order_data,
                },
            ];

            let order_id: u256 = 'someId'.into();

            (
                ResolvedCrossChainOrder {
                    user: sender,
                    origin_chain_id: self.origin.read(),
                    open_deadline,
                    fill_deadline,
                    order_id,
                    min_received,
                    max_spent,
                    fill_instructions,
                },
                order_id,
                1,
            )
        }
    }

    /// BASE OVERRIDES ///
    pub impl Base7686VirtualImpl of Base7683Component::Virtual<ContractState> {
        fn _fill_order(
            ref self: Base7683Component::ComponentState<ContractState>,
            order_id: u256,
            origin_data: @Bytes,
            filler_data: @Bytes,
        ) {
            BasicSwap7683Component::InternalImpl::_fill_order(
                ref self, order_id, origin_data, filler_data,
            );
        }

        fn _resolve_onchain_order(
            self: @Base7683Component::ComponentState<ContractState>, order: @OnchainCrossChainOrder,
        ) -> (ResolvedCrossChainOrder, u256, felt252) {
            BasicSwap7683Component::InternalImpl::_resolve_onchain_order(self, order)
        }

        fn _resolve_gasless_order(
            self: @Base7683Component::ComponentState<ContractState>,
            order: @GaslessCrossChainOrder,
            origin_filler_data: @Bytes,
        ) -> (ResolvedCrossChainOrder, u256, felt252) {
            BasicSwap7683Component::InternalImpl::_resolve_gasless_order(
                self, order, origin_filler_data,
            )
        }
        fn _settle_orders(
            ref self: Base7683Component::ComponentState<ContractState>,
            order_ids: @Array<u256>,
            orders_origin_data: @Array<Bytes>,
            orders_filler_data: @Array<Bytes>,
            value: u256,
        ) {
            let mut contract_state = self.get_contract_mut();
            BasicSwap7683Component::InternalImpl::_settle_orders(
                ref contract_state.basic_swap7683,
                order_ids,
                orders_origin_data,
                orders_filler_data,
                value,
            );
        }

        fn _refund_onchain_orders(
            ref self: Base7683Component::ComponentState<ContractState>,
            orders: @Array<OnchainCrossChainOrder>,
            order_ids: @Array<u256>,
            value: u256,
        ) {
            let mut contract_state = self.get_contract_mut();
            BasicSwap7683Component::InternalImpl::_refund_onchain_orders(
                ref contract_state.basic_swap7683, orders, order_ids, value,
            );
        }

        fn _refund_gasless_orders(
            ref self: Base7683Component::ComponentState<ContractState>,
            orders: @Array<GaslessCrossChainOrder>,
            order_ids: @Array<u256>,
            value: u256,
        ) {
            let mut contract_state = self.get_contract_mut();
            BasicSwap7683Component::InternalImpl::_refund_gasless_orders(
                ref contract_state.basic_swap7683, orders, order_ids, value,
            );
        }

        fn _local_domain(self: @Base7683Component::ComponentState<ContractState>) -> u32 {
            1
        }

        fn _get_gasless_order_id(
            self: @Base7683Component::ComponentState<ContractState>, order: @GaslessCrossChainOrder,
        ) -> u256 {
            compute_keccak_byte_array(@Into::<Bytes, ByteArray>::into(order.order_data.clone()))
        }

        fn _get_onchain_order_id(
            self: @Base7683Component::ComponentState<ContractState>, order: @OnchainCrossChainOrder,
        ) -> u256 {
            compute_keccak_byte_array(@Into::<Bytes, ByteArray>::into(order.order_data.clone()))
        }
    }

    /// BASIC SWAP OVERRIDES ///
    pub impl BasicSwap7686VirtualImpl of BasicSwap7683Component::Virtual<ContractState> {
        fn _dispatch_settle(
            ref self: BasicSwap7683Component::ComponentState<ContractState>,
            origin_domain: u32,
            order_ids: @Array<u256>,
            orders_filler_data: @Array<Bytes>,
            value: u256,
        ) {
            let mut self = self.get_contract_mut();
            self.dispatched_origin_domain.write(origin_domain);

            self.dispatched_order_ids_len.write(order_ids.len());
            for i in 0..order_ids.len() {
                self.dispatched_order_ids.entry(i).write(*order_ids[i]);
            };

            self.dispatched_orders_filler_data_len.write(orders_filler_data.len());
            for i in 0..orders_filler_data.len() {
                self.dispatched_orders_filler_data.entry(i).write(orders_filler_data[i].clone());
            };
        }

        fn _dispatch_refund(
            ref self: BasicSwap7683Component::ComponentState<ContractState>,
            origin_domain: u32,
            order_ids: @Array<u256>,
            value: u256,
        ) {
            let mut self = self.get_contract_mut();
            self.dispatched_origin_domain.write(origin_domain);

            self.dispatched_order_ids_len.write(order_ids.len());
            for i in 0..order_ids.len() {
                self.dispatched_order_ids.entry(i).write(*order_ids[i]);
            };
        }

        fn _handle_settle_order(
            ref self: BasicSwap7683Component::ComponentState<ContractState>,
            message_origin: u32,
            message_sender: ContractAddress,
            order_id: u256,
            receiver: ContractAddress,
        ) {
            let mut contract_state = self.get_contract_mut();

            BasicSwap7683Component::InternalImpl::_handle_settle_order(
                ref contract_state.basic_swap7683,
                message_origin,
                message_sender,
                order_id,
                receiver,
            );
        }

        fn _handle_refund_order(
            ref self: BasicSwap7683Component::ComponentState<ContractState>,
            message_origin: u32,
            message_sender: ContractAddress,
            order_id: u256,
        ) {
            let mut contract_state = self.get_contract_mut();
            BasicSwap7683Component::InternalImpl::_handle_refund_order(
                ref contract_state.basic_swap7683, message_origin, message_sender, order_id,
            );
        }
    }
}
