#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[cfg(test)]
mod integration_tests {
    use ink_e2e::*;
    
    type E2EResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;

    #[ink_e2e::test]
    async fn test_full_mint_and_tax_flow(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
        // 1. Deploy tax_manager contract
        let tax_manager_constructor = tax_manager::TaxManagerRef::new(
            1000, // 10% tax rate (1000 basis points)
            alice_account_id(),
            alice_account_id(),
            alice_account_id(),
            alice_account_id(),
        );
        
        let tax_manager_acc_id = client
            .instantiate("tax_manager", &ink_e2e::alice(), tax_manager_constructor, 0, None)
            .await
            .expect("instantiate failed")
            .account_id;

        // 2. Deploy lusdt_token contract
        let lusdt_constructor = lusdt_token::LusdtTokenRef::new(
            bob_account_id(), // bridge_account
            tax_manager_acc_id,
            charlie_account_id(), // emergency_admin
        );

        let lusdt_acc_id = client
            .instantiate("lusdt_token", &ink_e2e::alice(), lusdt_constructor, 0, None)
            .await
            .expect("instantiate failed")
            .account_id;

        // 3. Test mint operation with tax collection
        let mint_call = build_message::<lusdt_token::LusdtTokenRef>(lusdt_acc_id.clone())
            .call(|token| token.mint(alice_account_id(), 1000000000)); // 1000 LUSDT

        let mint_result = client
            .call(&ink_e2e::bob(), mint_call, 0, None)
            .await
            .expect("mint failed");

        assert!(mint_result.return_value().is_ok());

        // 4. Verify balance and tax collection
        let balance_call = build_message::<lusdt_token::LusdtTokenRef>(lusdt_acc_id.clone())
            .call(|token| token.balance_of(alice_account_id()));

        let balance_result = client
            .call(&ink_e2e::alice(), balance_call, 0, None)
            .await
            .expect("balance_of failed");

        // Should be less than 1000 LUSDT due to tax
        assert!(balance_result.return_value() < 1000000000);

        // 5. Test burn operation with redemption
        let burn_call = build_message::<lusdt_token::LusdtTokenRef>(lusdt_acc_id.clone())
            .call(|token| token.burn(500000000, "SolanaAddressExample123".to_string()));

        let burn_result = client
            .call(&ink_e2e::alice(), burn_call, 0, None)
            .await
            .expect("burn failed");

        assert!(burn_result.return_value().is_ok());

        Ok(())
    }

    #[ink_e2e::test]
    async fn test_emergency_pause_functionality(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
        // Deploy contracts (similar setup as above)
        // ...

        // Test emergency pause
        let pause_call = build_message::<lusdt_token::LusdtTokenRef>(lusdt_acc_id.clone())
            .call(|token| token.emergency_pause("Security breach detected".to_string()));

        let pause_result = client
            .call(&ink_e2e::charlie(), pause_call, 0, None) // emergency_admin
            .await
            .expect("pause failed");

        assert!(pause_result.return_value().is_ok());

        // Verify operations are blocked
        let mint_call = build_message::<lusdt_token::LusdtTokenRef>(lusdt_acc_id.clone())
            .call(|token| token.mint(alice_account_id(), 1000000));

        let mint_result = client
            .call(&ink_e2e::bob(), mint_call, 0, None)
            .await;

        // Should fail because contract is paused
        assert!(mint_result.is_err() || !mint_result.unwrap().return_value().is_ok());

        Ok(())
    }

    #[ink_e2e::test] 
    async fn test_rate_limiting(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
        // Test mint rate limiting functionality
        // Deploy contracts...
        
        // Attempt multiple large mints in quick succession
        for i in 0..5 {
            let mint_call = build_message::<lusdt_token::LusdtTokenRef>(lusdt_acc_id.clone())
                .call(|token| token.mint(alice_account_id(), 10000000000)); // 10k LUSDT

            let mint_result = client
                .call(&ink_e2e::bob(), mint_call, 0, None)
                .await;

            if i >= 3 { // Should start failing due to rate limit
                assert!(mint_result.is_err() || !mint_result.unwrap().return_value().is_ok());
            }
        }

        Ok(())
    }
}