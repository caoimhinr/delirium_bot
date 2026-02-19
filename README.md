# delirium_bot

## Setup 

Update the container
```
apt update && apt full-upgrade -y
apt install -y curl git
```
Install node.js
```
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs
```
Create a bot folder
```
mkdir -p /opt/discord-bot
cd /opt/discord-bot
```
Install Discord.js
```
npm install discord.js
```
Make the bot run in the background

```
npm install -g pm2
cd /opt/delirium_bot
pm2 start index.js --name "delirium_bot"
pm2 list
```

View logs
```
pm2 logs discord-bot
```


Insults

Dude has 2 braincells and they are both fighting for third place.
Sharp as a box of rocks.
Not the sharpest knife in the drawer.
Can't tell the difference between shit and chocolate.
Dude is a right space cadet.
Lights are on but no one is home.
Gears aren't spinning but something is smoking.
One can short of a six pack.
The local village must be missing their idiot.
Hard of thinking.
Super nice but their IQ is kinda room temperature.
So dense they could make light bend.
Dense as lead, but half as useful.
Is that your brain or are you breaking it in for an idiot.
I don't have the energy or the crayons to explain this to you.
Keep rolling you eyes, maybe someday you'll find a brain back there.
I'm just glad stupidity isn't contagious.
Is your last name Dunning or Krueger by any chance?
You must've been in the gene pool while the lifeguard was off duty.
We are all victims of our own gene pools, someone just must've pissed in yours.
Wisdom has been chasing you for years, but you're just fast enough to outrun it.
Did your parents have any children that actually survived?
If you were on trial you would probably defend yourself.
You don't read much do you?
Guess you slept in when god was handing out brains.
Can't pick out a tree in a forest.
Common sense wasn't too common in your house was it?
Would you rather have a dictionary or a thesaurus for your birthday? Oh sorry a thesaurus is the one that gives words that mean similar things to the word you look up.
Your mother used to tell you that you were a star growing up, eh? Well, she's right you are a giant, glowing star.
It must be nice to be so free of the burdens of intelligence.
He's as useful as a condom in a nunnery.
Really? Of all the sperm, you were the fastest?
How often do you experience this brain-mouth interface disconnect we've been seeing?
Are you Intellectually celibate by choice or unfortunate circumstances?
You'd probably bring a fork to a soup tasting.
You should wear a helmet more often, I don't know what will happen if you lose your last brain cell.
I'm not saying you're the dumbest person alive, but you better hope schoco doesn't die.
Their lift doesn't travel to the top floor and the architect forgot to include stairs.
If we sent you for an IQ test, you'd come back and tell us it was positive .
The eyes open, and your mouth moves, but it seems like anyone worth listening to left long ago .
By any chance is your uncle and your father the same person?
You'd have trouble pouring water out of a shoe with the instructions pinned to the heel wouldn't you?
You're as useful as tits on a bullfrog.
Where did you say you went to school again? I need to know where not to send my kids.
The only way you could be dumber is if you were an Isekai dev.
Sorry, could you repeat what you said? That idea kinda sounded like you were having a stroke.
I bet you have a beautifully smooth brain don't you?
Oh you dropped out? Makes sense. You seem like someone who has been educated beyond their capacity.
My gramma used to tell me I should work smarter, not harder, but your way works too.
Man, you'd really fit in in Toronto, or better yet, Orlando.
You're as useful as the last 4 letters in the word queue.
I bet the reason your parents divorced was that when your dad said "hand me downs" he wasn't talking about secondhand clothing.
You'd easily be the last man alive in a zombie apocalypse.
If I wanted to know how to conceive sheer stupidity, I would ask your parents what position they used to make you.