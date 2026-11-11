use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

fn acc(s: &str) -> AccountId { s.parse().unwrap() }

const T0: u64 = 1_000_000_000;

fn ctx(pred: &str, ms: u64, block: u64) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc("dao.near")).predecessor_account_id(acc(pred))
        .block_timestamp(ms * 1_000_000).block_height(block).prepaid_gas(Gas::from_tgas(300));
    b
}

fn dao() -> Dao {
    testing_env!(ctx("nft.near", T0, 100).build());
    Dao::new(acc("nft.near"), acc("treasury.near"), None)
}

fn spend() -> Kind { Kind::Spend { recipient: acc("vendor.near"), asset: "near".into(), amount: U128(5) } }

/// Opens a 10-NFT spend proposal at block 100 with the minimum parameters.
fn open(d: &mut Dao) -> u64 {
    testing_env!(ctx("nft.near", T0, 100).build());
    d.create_proposal(acc("alice.near"), spend(), "Pay the venue".into(), U64(3 * DAY_MS), 1000, 5000, U64(2 * DAY_MS), U64(10))
}

fn vote(d: &mut Dao, id: u64, token: &str, last: u64, choice: u8, ms: u64) {
    testing_env!(ctx("nft.near", ms, 150).build());
    d.record_vote(id, acc("voter.near"), token.into(), U64(last), choice);
}

const AFTER_VOTE: u64 = T0 + 3 * DAY_MS;
const AFTER_LOCK: u64 = T0 + 5 * DAY_MS;

#[test]
fn proposer_bounds_are_enforced_per_kind() {
    let mut d = dao();
    testing_env!(ctx("nft.near", T0, 100).build());
    for (period, quorum, pass, lock, why) in [
        (DAY_MS, 1000, 5000, 2 * DAY_MS, "Voting period"),
        (3 * DAY_MS, 100, 5000, 2 * DAY_MS, "Quorum"),
        (3 * DAY_MS, 1000, 4000, 2 * DAY_MS, "Pass threshold"),
        (3 * DAY_MS, 1000, 5000, 1, "Timelock"),
    ] {
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            d.create_proposal(acc("a.near"), spend(), "p".into(), U64(period), quorum, pass, U64(lock), U64(10))
        }));
        let msg = format!("{:?}", r.err().and_then(|e| e.downcast_ref::<String>().cloned()));
        assert!(msg.contains(why), "{why}: {msg}");
    }
}

#[test]
#[should_panic(expected = "A purpose is required")]
fn spend_needs_a_purpose() {
    let mut d = dao();
    testing_env!(ctx("nft.near", T0, 100).build());
    d.create_proposal(acc("a.near"), spend(), "  ".into(), U64(3 * DAY_MS), 1000, 5000, U64(2 * DAY_MS), U64(10));
}

#[test]
#[should_panic(expected = "Only the NFT contract")]
fn only_the_nft_contract_can_create_or_vote() {
    let mut d = dao();
    testing_env!(ctx("anyone.near", T0, 100).build());
    d.create_proposal(acc("a.near"), spend(), "p".into(), U64(3 * DAY_MS), 1000, 5000, U64(2 * DAY_MS), U64(10));
}

#[test]
#[should_panic(expected = "Only the NFT contract")]
fn voters_cannot_call_record_vote_directly() {
    let mut d = dao();
    let id = open(&mut d);
    testing_env!(ctx("holder.near", T0 + 1, 150).build());
    d.record_vote(id, acc("holder.near"), "1".into(), U64(1), 1);
}

#[test]
#[should_panic(expected = "already voted")]
fn one_vote_per_token() {
    let mut d = dao();
    let id = open(&mut d);
    vote(&mut d, id, "1", 10, 1, T0 + 1);
    vote(&mut d, id, "1", 10, 0, T0 + 2);
}

#[test]
#[should_panic(expected = "changed hands after this proposal opened")]
fn token_transferred_after_start_cannot_vote() {
    let mut d = dao();
    let id = open(&mut d);
    vote(&mut d, id, "1", 100, 1, T0 + 1); // last transfer at block 100 == start block
}

#[test]
#[should_panic(expected = "Outside the voting window")]
fn no_votes_after_the_window() {
    let mut d = dao();
    let id = open(&mut d);
    vote(&mut d, id, "1", 10, 1, AFTER_VOTE);
}

#[test]
fn quorum_not_met_fails() {
    let mut d = dao();
    let id = open(&mut d);
    vote(&mut d, id, "1", 10, 1, T0 + 1); // 1 of 10 = 10%... exactly quorum
    assert_eq!(d.status_of(id), Status::Voting);
    testing_env!(ctx("x.near", AFTER_VOTE, 200).build());
    assert_eq!(d.status_of(id), Status::Passed);
    // A second proposal with zero votes fails on quorum.
    testing_env!(ctx("nft.near", T0, 100).build());
    let id2 = d.create_proposal(acc("a.near"), spend(), "p".into(), U64(3 * DAY_MS), 2000, 5000, U64(2 * DAY_MS), U64(10));
    vote(&mut d, id2, "1", 10, 1, T0 + 1); // 10% < 20%
    testing_env!(ctx("x.near", AFTER_VOTE, 200).build());
    assert_eq!(d.status_of(id2), Status::Failed);
}

#[test]
fn ties_fail_and_abstain_counts_only_for_quorum() {
    let mut d = dao();
    let id = open(&mut d);
    vote(&mut d, id, "1", 10, 1, T0 + 1);
    vote(&mut d, id, "2", 10, 0, T0 + 2);
    testing_env!(ctx("x.near", AFTER_VOTE, 200).build());
    assert_eq!(d.status_of(id), Status::Failed, "1 yes vs 1 no is a tie");

    testing_env!(ctx("nft.near", T0, 100).build());
    let id2 = d.create_proposal(acc("a.near"), spend(), "p".into(), U64(3 * DAY_MS), 1000, 5000, U64(2 * DAY_MS), U64(10));
    vote(&mut d, id2, "1", 10, 1, T0 + 1);
    vote(&mut d, id2, "2", 10, 2, T0 + 2);
    vote(&mut d, id2, "3", 10, 2, T0 + 3);
    testing_env!(ctx("x.near", AFTER_VOTE, 200).build());
    assert_eq!(d.status_of(id2), Status::Passed, "abstentions do not count against");
}

#[test]
#[should_panic(expected = "has not passed")]
fn failed_proposal_cannot_be_executed() {
    let mut d = dao();
    let id = open(&mut d);
    testing_env!(ctx("x.near", AFTER_LOCK, 200).build());
    let _ = d.execute(id);
}

#[test]
#[should_panic(expected = "Timelock has not elapsed")]
fn passed_proposal_waits_for_timelock() {
    let mut d = dao();
    let id = open(&mut d);
    vote(&mut d, id, "1", 10, 1, T0 + 1);
    testing_env!(ctx("x.near", AFTER_VOTE + 1, 200).build());
    let _ = d.execute(id);
}

#[test]
fn execute_is_permissionless_once_and_retryable_on_failure() {
    let mut d = dao();
    let id = open(&mut d);
    vote(&mut d, id, "1", 10, 1, T0 + 1);
    testing_env!(ctx("stranger.near", AFTER_LOCK, 200).build());
    let _ = d.execute(id);
    assert_eq!(d.status_of(id), Status::Executed, "marked before the outbound call");
    // The payment failed: the proposal becomes executable again.
    testing_env!(ctx("dao.near", AFTER_LOCK, 201).build());
    d.on_executed(Err(PromiseError::Failed), id);
    assert_eq!(d.status_of(id), Status::Passed);
}

#[test]
#[should_panic(expected = "has not passed or was already executed")]
fn no_double_execution() {
    let mut d = dao();
    let id = open(&mut d);
    vote(&mut d, id, "1", 10, 1, T0 + 1);
    testing_env!(ctx("stranger.near", AFTER_LOCK, 200).build());
    let _ = d.execute(id);
    let _ = d.execute(id);
}


// ------------------------------------------------------------ swap proposals

fn hop() -> Hop { Hop { pool_id: 79, token_out: acc("usdc.near") } }

#[test]
fn settle_and_swap_proposals_need_a_minimum_output_and_the_spend_bounds() {
    let mut d = dao();
    testing_env!(ctx("nft.near", T0, 100).build());
    let settle = |min: u128| Kind::Settle { group: 0, hops: vec![hop()], min_out: U128(min) };
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        d.create_proposal(acc("a.near"), settle(0), "settle".into(), U64(3 * DAY_MS), 1000, 5000, U64(2 * DAY_MS), U64(10))
    }));
    assert!(format!("{:?}", r.err().and_then(|e| e.downcast_ref::<String>().cloned())).contains("minimum output"));
    // Same floor as spending: a short voting period is refused.
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        d.create_proposal(acc("a.near"), settle(5), "settle".into(), U64(DAY_MS), 1000, 5000, U64(2 * DAY_MS), U64(10))
    }));
    assert!(format!("{:?}", r.err().and_then(|e| e.downcast_ref::<String>().cloned())).contains("Voting period"));
    let id = d.create_proposal(acc("a.near"), settle(5), "settle".into(), U64(3 * DAY_MS), 1000, 5000, U64(2 * DAY_MS), U64(10));
    assert_eq!(id, 1);
}

#[test]
fn a_passed_settle_proposal_executes_once() {
    let mut d = dao();
    testing_env!(ctx("nft.near", T0, 100).build());
    let id = d.create_proposal(acc("a.near"), Kind::Settle { group: 0, hops: vec![hop()], min_out: U128(5) }, "settle".into(), U64(3 * DAY_MS), 1000, 5000, U64(2 * DAY_MS), U64(10));
    vote(&mut d, id, "1", 10, 1, T0 + 1);
    testing_env!(ctx("stranger.near", AFTER_LOCK, 200).build());
    let _ = d.execute(id);
    assert_eq!(d.status_of(id), Status::Executed);
}

#[test]
fn swap_proposals_round_trip_through_json() {
    let k = Kind::Swap { token_in: "near".into(), amount: U128(7), token_out: acc("usdc.near"), hops: vec![hop()], min_out: U128(3), dex: acc("v2.ref-finance.near") };
    let s = near_sdk::serde_json::to_string(&k).unwrap();
    let back: Kind = near_sdk::serde_json::from_str(&s).unwrap();
    assert_eq!(k, back);
}

#[test]
#[should_panic(expected = "Asset must be")]
fn a_spend_proposal_with_a_non_canonical_asset_is_refused() {
    let mut d = dao();
    testing_env!(ctx("nft.near", T0, 100).build());
    let kind = Kind::Spend { recipient: acc("vendor.near"), asset: "NEAR".into(), amount: U128(5) };
    d.create_proposal(acc("alice.near"), kind, "Pay".into(), U64(3 * DAY_MS), 1000, 5000, U64(2 * DAY_MS), U64(10));
}

#[test]
fn a_batch_vote_counts_every_token_in_one_call() {
    let mut d = dao();
    let id = open(&mut d);
    testing_env!(ctx("nft.near", T0 + 1_000, 150).build());
    d.record_votes(id, acc("voter.near"), vec![
        VoteToken { token_id: "1".into(), last_transfer_block: U64(10) },
        VoteToken { token_id: "2".into(), last_transfer_block: U64(10) },
        VoteToken { token_id: "3".into(), last_transfer_block: U64(10) },
    ], 1);
    assert_eq!(d.get_proposal(id).unwrap().yes.0, 3);
    assert!(d.has_voted(id, "2".into()));
}

#[test]
#[should_panic(expected = "changed hands")]
fn one_ineligible_token_fails_the_whole_batch() {
    let mut d = dao();
    let id = open(&mut d);
    testing_env!(ctx("nft.near", T0 + 1_000, 150).build());
    d.record_votes(id, acc("voter.near"), vec![
        VoteToken { token_id: "1".into(), last_transfer_block: U64(10) },
        VoteToken { token_id: "2".into(), last_transfer_block: U64(120) },
    ], 1);
}

#[test]
#[should_panic(expected = "longer than 30 days")]
fn a_voting_period_over_30_days_is_refused() {
    let mut d = dao();
    testing_env!(ctx("nft.near", T0, 100).build());
    d.create_proposal(acc("alice.near"), spend(), "Pay".into(), U64(31 * DAY_MS), 1000, 5000, U64(2 * DAY_MS), U64(10));
}

#[test]
fn a_passed_proposal_expires_after_the_execution_window() {
    let mut d = dao();
    let id = open(&mut d);
    for (i, t) in ["1", "2", "3"].iter().enumerate() { vote(&mut d, id, t, 10, 1, T0 + 1_000 + i as u64); }
    testing_env!(ctx("anyone.near", AFTER_LOCK, 200).build());
    assert_eq!(d.status_of(id), Status::Passed);
    testing_env!(ctx("anyone.near", AFTER_LOCK + 15 * DAY_MS, 200).build());
    assert_eq!(d.status_of(id), Status::Expired);
}

#[test]
fn list_proposals_returns_the_history_in_order() {
    let mut d = dao();
    let a = open(&mut d);
    let b = open(&mut d);
    let all = d.list_proposals(1, 10);
    assert_eq!(all.iter().map(|p| p.id).collect::<Vec<_>>(), vec![a, b]);
    assert_eq!(d.list_proposals(2, 10).len(), 1);
    assert!(d.list_proposals(3, 10).is_empty());
}
