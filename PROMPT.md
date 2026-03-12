# Description

Add a discord bot command $claim that allows a discord user to claim an event for himself or his guild. The bot should ask a series of questions to register the request.
The bot will present X amount of options and attach reactions to the message so the user can reply with a fixed response or expect the user to reply to the message with a custom response.

# Data Structure

Event
- ID
- Name

Guild
- ID
- Name
- Server

Member
- ID
- Guild ID
- Name
- IGN (in game name)

Claim
- Event ID
- Guild ID
- Member ID
- Phase
- Description

# Flow Example

- User: $claim
- Bot: displays the known events as a numbered list and attaches 1 - X reactions.
- User: Reacts 1
- Bot: lists the current claims. If the user already have a claim for theirself or guild ask edit or now with icon reactions for both (pen/plus).
- User: Reacts New
- Bot: Requests the user to respond with a phase number
- User: responds with "45"
- Bot: checks if the response is an integer and requests the user to respond with a description. A checkmark reaction is added so the user can complete the flow without a description
- User: Reacts Checkmark
- Bot: registers the claim in the database

# Maintenance interface

A maintenance page should exist to manage the records in postgres and do CRUD operations.
Discord auth integration should be used and checked with a file containing authorized member IDs

# Notes

The app runs on proxmox lxc and sits behind Nginx Proxy Manager.
The domain is discord.caoimhinr.online.
