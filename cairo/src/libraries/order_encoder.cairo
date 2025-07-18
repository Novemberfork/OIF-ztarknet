use core::num::traits::Pow;
use permit2::libraries::utils::selector;
use starknet::ContractAddress;
//use starknet::bytes_31::{
//    BYTES_IN_BYTES31, Bytes31Trait, POW_2_128, POW_2_8, U128IntoBytes31, U8IntoBytes31,
//    one_shift_left_bytes_felt252, one_shift_left_bytes_u128, split_u128, u8_at_u256,
//};

#[derive(Serde, Default, Drop)]
pub struct OrderData {
    pub sender: ContractAddress,
    pub recipient: ContractAddress,
    pub input_token: ContractAddress,
    pub output_token: ContractAddress,
    pub amount_in: u256,
    pub amount_out: u256,
    pub sender_nonce: felt252,
    pub origin_domain: u256,
    pub destination_domain: u256,
    pub destination_settler: ContractAddress,
    pub fill_deadline: u64,
    pub data: ByteArray,
}

impl ContractAddressDefault of Default<ContractAddress> {
    fn default() -> ContractAddress {
        0x0.try_into().unwrap_or_default()
    }
}


pub trait OrderEncoder {
    const ORDER_DATA_TYPE_HASH: felt252;
    fn order_data_type_hash() -> felt252;
    fn id(order: @OrderData) -> felt252;
    fn encode(order: @OrderData) -> ByteArray;
    fn decode(order_data: @ByteArray) -> OrderData;
}

trait IntoU64Array<T> {
    fn into_u64_array(self: T) -> Array<u64>;
}

trait IntoBytes31Array<T> {
    fn into_bytes31_array(self: T) -> Array<bytes31>;
}


//const LOW_U64_MASK: u256 = 0xFFFF_FFFF_FFFF_FFFF;

//impl U128IntoU64Array of IntoU64Array<u128> {
//    fn into_u64_array(self: u128) -> Array<u64> {
//        let low: u64 = (self % 2_u128.pow(64)).try_into().unwrap();
//        let high: u64 = (self / 2_u128.pow(64)).try_into().unwrap();
//
//        array![low, high]
//    }
//}
//
//impl U256IntoU64Array of IntoU64Array<u256> {
//    fn into_u64_array(self: u256) -> Array<u64> {
//        let u256 { low, high } = self;
//        let lows = low.into_u64_array();
//        let highs = high.into_u64_array();
//
//        array![*lows.at(0), *lows.at(1), *highs.at(0), *highs.at(1)]
//    }
//}

impl ContractAddressIntoU256 of Into<ContractAddress, u256> {
    fn into(self: ContractAddress) -> u256 {
        Into::<ContractAddress, felt252>::into(self).into()
    }
}

//impl ContractAddressIntoU64Array of IntoU64Array<ContractAddress> {
//    fn into_u64_array(self: ContractAddress) -> Array<u64> {
//        Into::<felt252, u256>::into(Into::<ContractAddress, felt252>::into(self)).into_u64_array()
//    }
//}

pub impl OrderEncoderImpl of OrderEncoder {
    const ORDER_DATA_TYPE_HASH: felt252 = selector!(
        "\"Order Data\"(\"Sender\":\"ContractAddress\",\"Recipient\":\"ContractAddress\",\"Input Token\":\"ContractAddress\",\"Output Token\":\"ContractAddress\",\"Amount In\":\"u256\",\"Amount Out\":\"u256\",\"Sender Nonce\":\"felt\",\"Origin Domain\":\"u256\",\"Destination Domain\":\"u256\",\"Destination Settler\":\"ContractAddress\",\"Fill Deadline\":\"timestamp\",\"Data\":\"string\")",
    );


    fn order_data_type_hash() -> felt252 {
        Self::ORDER_DATA_TYPE_HASH
    }


    fn encode(order: @OrderData) -> ByteArray {
        let mut encoded = "";
        let OrderData {
            sender,
            recipient,
            input_token,
            output_token,
            amount_in,
            amount_out,
            sender_nonce,
            origin_domain,
            destination_domain,
            destination_settler,
            fill_deadline,
            data,
        } = order;

        let sender: u256 = (*sender).into();
        encoded.append_word(sender.low.into(), 16);
        encoded.append_word(sender.high.into(), 16);

        let recipient: u256 = (*recipient).into();
        encoded.append_word(recipient.low.into(), 16);
        encoded.append_word(recipient.high.into(), 16);

        let input_token: u256 = (*input_token).into();
        encoded.append_word(input_token.low.into(), 16);
        encoded.append_word(input_token.high.into(), 16);

        let output_token: u256 = (*output_token).into();
        encoded.append_word(output_token.low.into(), 16);
        encoded.append_word(output_token.high.into(), 16);

        encoded.append_word((*amount_in).low.into(), 16);
        encoded.append_word((*amount_in).high.into(), 16);

        encoded.append_word((*amount_out).low.into(), 16);
        encoded.append_word((*amount_out).high.into(), 16);

        let sender_nonce: u256 = (*sender_nonce).into();
        encoded.append_word(sender_nonce.low.into(), 16);
        encoded.append_word(sender_nonce.high.into(), 16);

        encoded.append_word((*origin_domain.low).into(), 16);
        encoded.append_word((*origin_domain.high).into(), 16);

        encoded.append_word((*destination_domain.low).into(), 16);
        encoded.append_word((*destination_domain.high).into(), 16);

        let destination_settler: u256 = (*destination_settler).into();
        encoded.append_word(destination_settler.low.into(), 31);
        encoded.append_word(destination_settler.high.into(), 31);

        encoded.append_word((*fill_deadline).into(), 8);

        encoded.append(data);

        encoded
    }

    fn decode(order_data: @ByteArray) -> OrderData {
        let mut index: usize = 0;
        let mut span = 33_usize;

        let mut sender = '';
        let mut shift = 0x1_u256;
        for _ in index..span {
            let byte = order_data.at(index).unwrap();
            let shifted = byte.into() * shift;

            sender += shifted.try_into().unwrap();

            index += 1;
            shift *= 0x100;
        }

        shift = 0x1_u256;
        let mut recipient = '';
        for _ in index..span {
            let byte = order_data.at(index).unwrap();
            let shifted = byte.into() * shift;

            recipient += shifted.try_into().unwrap();

            index += 1;
            shift *= 0x100;
        }

        shift = 0x1_u256;
        let mut input_token = '';
        for _ in index..span {
            let byte = order_data.at(index).unwrap();
            let shifted = byte.into() * shift;

            input_token += shifted.try_into().unwrap();

            index += 1;
            shift *= 0x100;
        }

        shift = 0x1_u256;
        let mut output_token = '';
        for _ in index..span {
            let byte = order_data.at(index).unwrap();
            let shifted = byte.into() * shift;

            output_token += shifted.try_into().unwrap();

            index += 1;
            shift *= 0x100;
        }

        shift = 0x1_u256;
        let mut amount_in = 0_u256;
        for _ in index..span {
            let byte = order_data.at(index).unwrap();
            let shifted = byte.into() * shift;

            amount_in += shifted;

            index += 1;
            shift *= 0x100;
        }

        shift = 0x1_u256;
        let mut amount_out = 0_u256;
        for _ in index..span {
            let byte = order_data.at(index).unwrap();
            let shifted = byte.into() * shift;

            amount_out += shifted;

            index += 1;
            shift *= 0x100;
        }

        shift = 0x1_u256;
        let mut sender_nonce = '';
        for _ in index..span {
            let byte = order_data.at(index).unwrap();
            let shifted = byte.into() * shift;

            sender_nonce += shifted.try_into().unwrap();

            index += 1;
            shift *= 0x100;
        }

        shift = 0x1_u256;
        let mut origin_domain = 0_u256;
        for _ in index..span {
            let byte = order_data.at(index).unwrap();
            let shifted = byte.into() * shift;

            origin_domain += shifted;

            index += 1;
            shift *= 0x100;
        }

        shift = 0x1_u256;
        let mut destination_domain = 0_u256;
        for _ in index..span {
            let byte = order_data.at(index).unwrap();
            let shifted = byte.into() * shift;

            destination_domain += shifted;

            index += 1;
            shift *= 0x100;
        }

        shift = 0x1_u256;
        let mut destination_settler = '';
        for _ in index..span {
            let byte = order_data.at(index).unwrap();
            let shifted = byte.into() * shift;

            destination_settler += shifted.try_into().unwrap();

            index += 1;
            shift *= 0x100;
        }

        shift = 0x1_u256;
        span = 8_usize;
        let mut fill_deadline = 0_u64;
        for _ in index..span {
            let byte = order_data.at(index).unwrap();
            let shifted = byte.into() * shift;

            fill_deadline += shifted.try_into().unwrap();

            index += 1;
            shift *= 0x100;
        }

        shift = 0x1_u256;
        let mut data = "";
        for _ in index..order_data.len() {
            let byte = order_data.at(index).unwrap();
            let shifted = byte.into() * shift;

            data.append_word(shifted.try_into().unwrap(), 1);

            index += 1;
            shift *= 0x100;
        }

        OrderData {
            sender: sender.try_into().unwrap(),
            recipient: recipient.try_into().unwrap(),
            input_token: input_token.try_into().unwrap(),
            output_token: output_token.try_into().unwrap(),
            amount_in,
            amount_out,
            sender_nonce,
            origin_domain,
            destination_domain,
            destination_settler: destination_settler.try_into().unwrap(),
            fill_deadline,
            data,
        }
    }

    fn id(order: @OrderData) -> felt252 {
        selector(Self::encode(order))
    }
}

pub trait OpenOrderEncoder<T> {
    fn encode(self: T) -> ByteArray;
    fn decode(self: ByteArray) -> T;
}

pub impl OpenOrderEncoderImplAt of OpenOrderEncoder<(felt252, @ByteArray)> {
    fn encode(self: (felt252, @ByteArray)) -> ByteArray {
        let (order_data_type, data) = self;
        let mut encoded = "";

        let order_data_type: u256 = order_data_type.into();
        encoded.append_word(order_data_type.low.into(), 16);
        encoded.append_word(order_data_type.high.into(), 16);

        encoded.append(data);

        encoded
    }

    fn decode(self: ByteArray) -> (felt252, @ByteArray) {
        let mut index: usize = 0;
        let mut span = 33_usize;

        let mut order_data_type = '';
        let mut shift = 0x1_u256;
        for _ in index..span {
            let byte = self.at(index).unwrap();
            let shifted = byte.into() * shift;

            order_data_type += shifted.try_into().unwrap();

            index += 1;
            shift *= 0x100;
        }

        let mut data = "";
        shift = 0x1_u256;
        for _ in index..span {
            let byte = self.at(index).unwrap();
            let shifted = byte.into() * shift;

            data.append_word(shifted.try_into().unwrap(), 1);

            index += 1;
            shift *= 0x100;
        }

        (order_data_type.try_into().unwrap(), @data)
    }
}

pub impl OpenOrderEncoderImpl of OpenOrderEncoder<(felt252, ByteArray)> {
    fn encode(self: (felt252, ByteArray)) -> ByteArray {
        let (order_data_type, data) = self;
        let mut encoded = "";

        let order_data_type: u256 = order_data_type.into();
        encoded.append_word(order_data_type.low.into(), 16);
        encoded.append_word(order_data_type.high.into(), 16);

        encoded.append(@data);

        encoded
    }

    fn decode(self: ByteArray) -> (felt252, ByteArray) {
        let mut index: usize = 0;
        let mut span = 33_usize;

        let mut order_data_type = '';
        let mut shift = 0x1_u256;
        for _ in index..span {
            let byte = self.at(index).unwrap();
            let shifted = byte.into() * shift;

            order_data_type += shifted.try_into().unwrap();

            index += 1;
            shift *= 0x100;
        }

        let mut data = "";
        shift = 0x1_u256;
        for _ in index..span {
            let byte = self.at(index).unwrap();
            let shifted = byte.into() * shift;

            data.append_word(shifted.try_into().unwrap(), 1);

            index += 1;
            shift *= 0x100;
        }

        (order_data_type.try_into().unwrap(), data)
    }
}

