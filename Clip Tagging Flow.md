# Clip Tagging Overlay Workflow Order (Current)

This is the current order used by the clip tagging overlay when clicking **Start Tagging** (not the **Add Tags** tree selector).

## Entry
- Open clip overlay
- Click **Start Tagging**

## Step Behavior
- On every **Next**, selected tags for that step are applied to both parent scene and clip
- For multi-select steps, tags already present on the parent scene are auto-selected
- Workflow completes after the final **Cum Shot** step and returns to clip overlay

## Ordered Steps
1. Performer Count
- Options: Solo, Couple Sex, Threesome, Foursome, Fivesome, Orgy
- Auto-selects based on scene performer count when available

2. Performer Race
- Options: Arabian, Asian, Black, Latin American, White
- If performer count is not Solo and at least one race is selected, Multi-Racial is auto-added on apply

3. Sex Acts
- If Solo: Masturbation, Autofellatio
- Otherwise: Oral Sex, Anal Sex, Kissing, Masturbation, Fingering, Rimming

4. Conditional branch after Sex Acts
- If Masturbation selected: go to Masturbation
- Else if Oral Sex selected and not Solo: go to Oral Sex
- Else if Anal Sex selected and not Solo: go to Anal Sex
- Else: go to Cum Shot

5. Masturbation (conditional)
- Base: Sitting Masturbation, Laying Masturbation, Standing Masturbation
- If not Solo: add Couple Masturbation, Handjob
- If Threesome/Foursome/Fivesome/Orgy: add Circle-Jerk, 2 in 1 hand

6. Oral Sex (conditional)
- Base: 69, Ball Licking, Dick Licking, Face Fuck, Kneeling, Laying, Side Fuck Blowjob, Standing Blowjob
- If Threesome/Foursome/Fivesome/Orgy: add Double Blowjob, Train (Oral Sex)
- If Multi-Racial context detected: add Black Suck White, White Suck Black
- Next always goes to Performer Oral

7. Performer Oral (conditional)
- Assign per performer: Oral - Give and/or Oral - Receive
- If Rimming selected in Sex Acts and not Solo: next is Performer Rimming
- Else if Anal Sex selected and not Solo: next is Anal Sex
- Else: next is Cum Shot

8. Performer Rimming (conditional)
- Assign per performer: Rim - Give and/or Rim - Receive
- If Anal Sex selected and not Solo: next is Anal Sex
- Else: next is Cum Shot

9. Anal Sex (conditional)
- Base: Cowboy, Doggy Style, Flip Flop, Missionary, Reverse Cowboy, Side Fuck, Standing Sex, Condom, No Condom
- If Threesome/Foursome/Fivesome/Orgy: add Double Anal Penetration (DAP), GangBang, Train (Penetration Chain), Spit Roast
- If Multi-Racial context detected: add Black Fuck White
- Next always goes to Performer Positions

10. Performer Positions (conditional)
- Assign per performer: Top and/or Bottom
- Next goes to Cum Shot

11. Cum Shot (final)
- Base: Huge Load, Cum Eating, Cum On Balls, Cum Play, Cum Standing, Cum in Mouth, Cum on Body, Cum on Chest, Cum on Crotch, Cum on Dick, Cum on Hands, Facial Cumshot, Hands-Free Orgasm, Multiple Cumshots, Spits Cum Out, Cumpilation
- If not Solo: add Cum Being Jerked Off, Top Finished Bottom
- Next completes workflow and returns to overlay