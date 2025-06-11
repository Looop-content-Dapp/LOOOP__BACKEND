export const factoryAbi = [
    {
      "type": "impl",
      "name": "ITribesFactoryImpl",
      "interface_name": "loop_starknet::interfaces::ITribesFactory"
    },
    {
      "type": "struct",
      "name": "core::byte_array::ByteArray",
      "members": [
        {
          "name": "data",
          "type": "core::array::Array::<core::bytes_31::bytes31>"
        },
        {
          "name": "pending_word",
          "type": "core::felt252"
        },
        {
          "name": "pending_word_len",
          "type": "core::integer::u32"
        }
      ]
    },
    {
      "type": "struct",
      "name": "core::integer::u256",
      "members": [
        {
          "name": "low",
          "type": "core::integer::u128"
        },
        {
          "name": "high",
          "type": "core::integer::u128"
        }
      ]
    },
    {
      "type": "struct",
      "name": "loop_starknet::factory::TribesNftFactory::Collection",
      "members": [
        {
          "name": "collection_id",
          "type": "core::integer::u32"
        },
        {
          "name": "name",
          "type": "core::byte_array::ByteArray"
        },
        {
          "name": "symbol",
          "type": "core::byte_array::ByteArray"
        },
        {
          "name": "artist",
          "type": "core::starknet::contract_address::ContractAddress"
        },
        {
          "name": "address",
          "type": "core::starknet::contract_address::ContractAddress"
        },
        {
          "name": "created_at",
          "type": "core::integer::u64"
        },
        {
          "name": "house_percentage",
          "type": "core::integer::u32"
        },
        {
          "name": "artist_percentage",
          "type": "core::integer::u32"
        },
        {
          "name": "collection_info",
          "type": "core::byte_array::ByteArray"
        }
      ]
    },
    {
      "type": "interface",
      "name": "loop_starknet::interfaces::ITribesFactory",
      "items": [
        {
          "type": "function",
          "name": "create_collection",
          "inputs": [
            {
              "name": "pauser",
              "type": "core::starknet::contract_address::ContractAddress"
            },
            {
              "name": "name",
              "type": "core::byte_array::ByteArray"
            },
            {
              "name": "symbol",
              "type": "core::byte_array::ByteArray"
            },
            {
              "name": "collection_details",
              "type": "core::byte_array::ByteArray"
            }
          ],
          "outputs": [
            {
              "type": "core::starknet::contract_address::ContractAddress"
            }
          ],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "update_royalties",
          "inputs": [
            {
              "name": "new_house_percentage",
              "type": "core::integer::u32"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "withdraw",
          "inputs": [
            {
              "name": "token",
              "type": "core::starknet::contract_address::ContractAddress"
            },
            {
              "name": "receiver",
              "type": "core::starknet::contract_address::ContractAddress"
            },
            {
              "name": "amount",
              "type": "core::integer::u256"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "check_balance",
          "inputs": [
            {
              "name": "token",
              "type": "core::starknet::contract_address::ContractAddress"
            },
            {
              "name": "address",
              "type": "core::starknet::contract_address::ContractAddress"
            }
          ],
          "outputs": [
            {
              "type": "core::integer::u256"
            }
          ],
          "state_mutability": "view"
        },
        {
          "type": "function",
          "name": "get_collection",
          "inputs": [
            {
              "name": "collection_id",
              "type": "core::integer::u32"
            }
          ],
          "outputs": [
            {
              "type": "loop_starknet::factory::TribesNftFactory::Collection"
            }
          ],
          "state_mutability": "view"
        },
        {
          "type": "function",
          "name": "get_artist_collections",
          "inputs": [
            {
              "name": "artist",
              "type": "core::starknet::contract_address::ContractAddress"
            }
          ],
          "outputs": [
            {
              "type": "core::array::Array::<loop_starknet::factory::TribesNftFactory::Collection>"
            }
          ],
          "state_mutability": "view"
        },
        {
          "type": "function",
          "name": "get_all_collections",
          "inputs": [],
          "outputs": [
            {
              "type": "core::array::Array::<loop_starknet::factory::TribesNftFactory::Collection>"
            }
          ],
          "state_mutability": "view"
        }
      ]
    },
    {
      "type": "impl",
      "name": "OwnableImpl",
      "interface_name": "openzeppelin_access::ownable::interface::IOwnable"
    },
    {
      "type": "interface",
      "name": "openzeppelin_access::ownable::interface::IOwnable",
      "items": [
        {
          "type": "function",
          "name": "owner",
          "inputs": [],
          "outputs": [
            {
              "type": "core::starknet::contract_address::ContractAddress"
            }
          ],
          "state_mutability": "view"
        },
        {
          "type": "function",
          "name": "transfer_ownership",
          "inputs": [
            {
              "name": "new_owner",
              "type": "core::starknet::contract_address::ContractAddress"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "renounce_ownership",
          "inputs": [],
          "outputs": [],
          "state_mutability": "external"
        }
      ]
    },
    {
      "type": "constructor",
      "name": "constructor",
      "inputs": [
        {
          "name": "owner",
          "type": "core::starknet::contract_address::ContractAddress"
        },
        {
          "name": "house_percentage",
          "type": "core::integer::u32"
        },
        {
          "name": "tribes_classhash",
          "type": "core::starknet::class_hash::ClassHash"
        },
        {
          "name": "payment_token",
          "type": "core::starknet::contract_address::ContractAddress"
        }
      ]
    },
    {
      "type": "event",
      "name": "loop_starknet::factory::TribesNftFactory::CollectionCreated",
      "kind": "struct",
      "members": [
        {
          "name": "artist",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "data"
        },
        {
          "name": "contract_address",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "data"
        },
        {
          "name": "house_percentage",
          "type": "core::integer::u32",
          "kind": "data"
        },
        {
          "name": "artist_percentage",
          "type": "core::integer::u32",
          "kind": "data"
        }
      ]
    },
    {
      "type": "event",
      "name": "loop_starknet::factory::TribesNftFactory::RoyaltiesUpdated",
      "kind": "struct",
      "members": [
        {
          "name": "house_percentage",
          "type": "core::integer::u32",
          "kind": "data"
        },
        {
          "name": "updated_at",
          "type": "core::integer::u64",
          "kind": "data"
        }
      ]
    },
    {
      "type": "event",
      "name": "openzeppelin_introspection::src5::SRC5Component::Event",
      "kind": "enum",
      "variants": []
    },
    {
      "type": "event",
      "name": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred",
      "kind": "struct",
      "members": [
        {
          "name": "previous_owner",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "key"
        },
        {
          "name": "new_owner",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "key"
        }
      ]
    },
    {
      "type": "event",
      "name": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
      "kind": "struct",
      "members": [
        {
          "name": "previous_owner",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "key"
        },
        {
          "name": "new_owner",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "key"
        }
      ]
    },
    {
      "type": "event",
      "name": "openzeppelin_access::ownable::ownable::OwnableComponent::Event",
      "kind": "enum",
      "variants": [
        {
          "name": "OwnershipTransferred",
          "type": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred",
          "kind": "nested"
        },
        {
          "name": "OwnershipTransferStarted",
          "type": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
          "kind": "nested"
        }
      ]
    },
    {
      "type": "event",
      "name": "loop_starknet::factory::TribesNftFactory::Event",
      "kind": "enum",
      "variants": [
        {
          "name": "CollectionCreated",
          "type": "loop_starknet::factory::TribesNftFactory::CollectionCreated",
          "kind": "nested"
        },
        {
          "name": "RoyaltiesUpdated",
          "type": "loop_starknet::factory::TribesNftFactory::RoyaltiesUpdated",
          "kind": "nested"
        },
        {
          "name": "SRC5Event",
          "type": "openzeppelin_introspection::src5::SRC5Component::Event",
          "kind": "flat"
        },
        {
          "name": "OwnableEvent",
          "type": "openzeppelin_access::ownable::ownable::OwnableComponent::Event",
          "kind": "flat"
        }
      ]
    }
  ]
