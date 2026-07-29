"""
Write the dictionary entry for a Definition Print, from the customer's questionnaire answers.

The customer answers three plain questions about their pet; Claude turns those into a
dictionary-style entry. Two rules shape the design:

  1. The pet's NAME never passes through the model. It's typeset verbatim from what the
     customer typed (see textart.py). Models misspell names, and a misspelled name on a
     printed canvas is a refund.
  2. The customer approves the wording before anything is rendered. This returns a draft
     for an editable field — it is not the final copy.

Falls back cleanly: no API key, or any error, and the caller just lets the customer write
their own line. The questionnaire is a convenience, not a dependency.
"""

import os

from pydantic import BaseModel, Field

MODEL = "claude-opus-4-8"

SYSTEM = """You write dictionary-style entries for custom pet portraits — the kind printed \
under the artwork on a canvas that hangs in someone's home.

Voice: warm, specific, gently funny. You are describing THIS pet, not pets in general. The \
humour comes from the specific detail the owner gave you, never from a generic joke about \
dogs or cats. Affection over cleverness — the owner should read it and feel you understood \
their pet, not that a machine wrote a pun.

Follow the form of a real dictionary entry: a definition, not a sentence about the pet. \
Start with a noun phrase ("A devoted crumb inspector who...", "The self-appointed supervisor \
of...") rather than "This dog is..." or the pet's name.

Two sentences maximum, under 200 characters total. Shorter is better — it has to fit on a \
canvas and be read from across a room.

Never invent facts the owner didn't give you. If an answer is thin, lean on what you have \
rather than padding with invented detail."""


class Entry(BaseModel):
    """The parts the model writes. The name is never one of them."""
    phonetic: str = Field(description=(
        "Dictionary-style pronunciation of the pet's name, lowercase, hyphen-separated "
        "syllables, e.g. 'ol-uh-ver' for Oliver or 'bis-kit' for Biscuit."))
    body: str = Field(description=(
        "The definition. Two sentences maximum, under 200 characters, dictionary voice."))


def write_entry(name, quirk, greeting="", obsession=""):
    """Draft a definition entry. Returns {"phonetic": ..., "body": ...}.

    Raises RuntimeError with a customer-safe message on any failure — callers should fall
    back to a blank editable field rather than blocking the order.
    """
    import anthropic

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    answers = ["Name: %s" % name, "The thing everyone jokes about: %s" % quirk]
    if greeting:
        answers.append("What they're like when the owner comes home: %s" % greeting)
    if obsession:
        answers.append("Weirdly obsessed with: %s" % obsession)

    client = anthropic.Anthropic()
    try:
        # No thinking: this is short copy and the customer is waiting on it. The structured
        # output keeps the response clean without it.
        resp = client.messages.parse(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM,
            messages=[{"role": "user", "content": "\n".join(answers)}],
            output_format=Entry,
        )
    except anthropic.APIStatusError as e:
        raise RuntimeError("Could not write the definition (%s)" % e.status_code)
    except anthropic.APIConnectionError:
        raise RuntimeError("Could not reach the writing service — please try again")

    entry = resp.parsed_output
    if not entry:
        raise RuntimeError("Could not write the definition")
    return {"phonetic": entry.phonetic.strip(), "body": entry.body.strip()}
