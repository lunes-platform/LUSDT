#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
pub mod mock_flipper {
    #[ink(storage)]
    pub struct MockFlipper {
        value: bool,
    }

    impl MockFlipper {
        #[ink(constructor)]
        pub fn new(init: bool) -> Self {
            Self { value: init }
        }

        #[ink(message)]
        pub fn get(&self) -> bool {
            self.value
        }

        #[ink(message)]
        pub fn flip(&mut self) {
            self.value = !self.value;
        }
    }
}
